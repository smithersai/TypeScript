package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// D495 reads each union member's own form before TypeScript combines its
// call signatures. Combining the cold signatures first loses the plain
// call in number | Effect<number>, which rule R correctly keeps as data.
func plainUnionCalleeType(c *checker.Checker, node *ast.Node, t *checker.Type) *checker.Type {
	call := node.Parent
	if call == nil || !ast.IsCallExpression(call) || call.Expression() != node ||
		!isVibeLangFile(ast.GetSourceFileOfNode(node)) || inHatch(node) || holdsProgram(c, call) {
		return t
	}
	a := analyzerFor(c)
	if fn := esFunctionOf(c, node); fn != nil && a.directReferenceOf(node, fn) != nil {
		return t // named direct calls keep their existing inference path
	}
	var members []*checker.Type
	converted := false
	// TypeScript can also collapse identical union members to one type.
	for _, member := range t.Distributed() {
		signatures := c.GetSignaturesOfType(member, checker.SignatureKindCall)
		if len(signatures) == 0 {
			return t
		}
		plain := member
		for _, sig := range signatures {
			fn := implementationOf(sig.Declaration())
			if isPlainCandidate(fn) && fn.Type() == nil {
				if !a.isPlainFunction(fn) || len(signatures) != 1 {
					return t
				}
				success := successType(c, c.GetReturnTypeOfSignature(sig))
				if success == nil {
					return t
				}
				plain = c.NewFunctionTypeWithReturnType(member.Symbol(), sig, success)
				converted = true
				continue
			}
			if fn == nil {
				return t
			}
			if isEffectType(c, c.GetReturnTypeOfSignature(sig)) {
				return t
			}
			file := ast.GetSourceFileOfNode(fn)
			if !isLibFile(c, file) && !isTrustedPackage(c, ast.GetSourceFileOfNode(call), packageOf(c, file)) &&
				!(isLowerable(fn) && a.hasPlainContract(fn)) {
				return t
			}
		}
		members = append(members, plain)
	}
	if !converted {
		return t
	}
	plain := c.GetUnionType(members)
	if a.plainUnionCalls == nil {
		a.plainUnionCalls = map[*ast.Node]*checker.Type{}
	}
	a.plainUnionCalls[call] = plain
	return plain
}

// A union may select a cold plain-form function or an ordinary trusted
// function. Preserve the receiver and evaluate the callee and arguments once.
func (tx *lowering) visitPlainUnionCall(node *ast.Node, signature string) *ast.Node {
	f := tx.Factory()
	parameter := func(name string) (*ast.Node, *ast.Node) {
		id := f.NewUniqueName(name)
		return id, f.NewParameterDeclaration(nil, nil, id, nil, nil, nil)
	}
	fn, fnParam := parameter("callee")
	self, selfParam := parameter("self")
	args, argsParam := parameter("args")
	property := func(value *ast.Node, name string) *ast.Node {
		return f.NewPropertyAccessExpression(value, nil, f.NewIdentifier(name), ast.NodeFlagsNone)
	}
	apply := func(value *ast.Node) *ast.Node {
		reflect := property(property(tx.runtimeMember("$global"), "Reflect"), "apply")
		return f.NewCallExpression(reflect, nil, nil, f.NewNodeList([]*ast.Node{value, self, args}), ast.NodeFlagsNone)
	}
	variable := func(name *ast.Node, value *ast.Node) *ast.Node {
		return f.NewVariableStatement(nil, f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{
			f.NewVariableDeclaration(name, nil, nil, value),
		}), ast.NodeFlagsConst))
	}
	direct, program, plain := f.NewUniqueName("direct"), f.NewUniqueName("program"), f.NewUniqueName("plain")
	present := func(value *ast.Node) *ast.Node {
		return f.NewBinaryExpression(nil, value, nil, f.NewToken(ast.KindExclamationEqualsEqualsToken), f.NewVoidZeroExpression())
	}
	key := f.NewCallExpression(property(property(tx.runtimeMember("$global"), "Symbol"), "for"), nil, nil,
		f.NewNodeList([]*ast.Node{f.NewStringLiteral("vibelang/plainForm", ast.TokenFlagsNone)}), ast.NodeFlagsNone)
	message := f.NewBinaryExpression(nil, f.NewStringLiteral("Plain call of ", ast.TokenFlagsNone), nil, f.NewToken(ast.KindPlusToken), property(fn, "name"))
	message = f.NewBinaryExpression(nil, message, nil, f.NewToken(ast.KindPlusToken), f.NewStringLiteral(" found no plain form for "+signature, ast.TokenFlagsNone))
	defect := f.NewNewExpression(property(tx.runtimeMember("$global"), "TypeError"), nil, f.NewNodeList([]*ast.Node{message}))
	body := f.NewBlock(f.NewNodeList([]*ast.Node{
		variable(direct, f.NewElementAccessExpression(fn, nil, tx.runtimeMember("$direct"), ast.NodeFlagsNone)),
		f.NewIfStatement(present(direct), f.NewReturnStatement(apply(direct)), nil),
		variable(program, apply(fn)),
		variable(plain, f.NewElementAccessExpression(program, f.NewToken(ast.KindQuestionDotToken), key, ast.NodeFlagsOptionalChain)),
		f.NewIfStatement(present(plain), f.NewReturnStatement(f.NewCallExpression(plain, nil, nil, nil, ast.NodeFlagsNone)), nil),
		f.NewIfStatement(f.NewCallExpression(property(tx.effectName(), "isEffect"), nil, nil, f.NewNodeList([]*ast.Node{program}), ast.NodeFlagsNone), f.NewThrowStatement(defect), nil),
		f.NewReturnStatement(program),
	}), true)
	callee := ast.SkipParentheses(node.Expression())
	var receiver, value *ast.Node
	if ast.IsPropertyAccessExpression(callee) || ast.IsElementAccessExpression(callee) {
		receiver = f.NewUniqueName("receiver")
		tx.EmitContext().AddVariableDeclaration(receiver)
		base := f.NewParenthesizedExpression(f.NewAssignmentExpression(receiver, tx.Visitor().VisitNode(callee.Expression())))
		if ast.IsPropertyAccessExpression(callee) {
			value = f.NewPropertyAccessExpression(base, nil, callee.Name(), ast.NodeFlagsNone)
		} else {
			value = f.NewElementAccessExpression(base, nil, tx.Visitor().VisitNode(callee.AsElementAccessExpression().ArgumentExpression), ast.NodeFlagsNone)
		}
	} else {
		value, receiver = tx.Visitor().VisitNode(node.Expression()), f.NewVoidZeroExpression()
	}
	lookup := f.NewParenthesizedExpression(tx.generated(tx.arrow([]*ast.Node{fnParam, selfParam, argsParam}, body)))
	arguments := f.NewArrayLiteralExpression(tx.Visitor().VisitNodes(node.ArgumentList()), false)
	return f.NewCallExpression(lookup, nil, nil, f.NewNodeList([]*ast.Node{value, receiver, arguments}), ast.NodeFlagsNone)
}
