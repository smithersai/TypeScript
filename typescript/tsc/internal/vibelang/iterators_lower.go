package vibelang

import "github.com/microsoft/TypeScript/tsc/internal/ast"

// protectIteratorFrames gives Effect ownership of native iterators that can
// remain live across a yield. Analyze the emitted frame, not source types or
// just a loop's visible body: binding defaults and assignment references can
// suspend too, and Array/string/any do not prove the iterator's identity.
//
// Retaining native patterns also retains their lexical bindings, evaluation
// order, nested iterator lifetimes and ECMAScript IteratorClose precedence.
func (tx *lowering) protectIteratorFrames(node *ast.Node) *ast.Node {
	visitor := tx.EmitContext().NewNodeVisitor(nil)
	visitor.Visit = func(node *ast.Node) *ast.Node {
		node = visitor.VisitEachChild(node)
		if !ast.IsCallExpression(node) {
			return node
		}
		call := node.AsCallExpression()
		callee := call.Expression
		// Effect.fn("span")(generator) is the traced form.
		if ast.IsCallExpression(callee) {
			callee = callee.Expression()
		}
		if !ast.IsPropertyAccessExpression(callee) || callee.Expression() != tx.effect {
			return node
		}
		switch callee.Name().Text() {
		case "gen", "fnUntraced", "fn":
		default:
			return node
		}
		arguments := append([]*ast.Node(nil), call.Arguments.Nodes...)
		changed := false
		for i, argument := range arguments {
			if body := iteratorGeneratorBody(argument); body != nil && iteratorPauses(body) {
				arguments[i] = tx.runtimeCall("$iteratorFrame", argument)
				changed = true
			}
		}
		if !changed {
			return node
		}
		return tx.Factory().UpdateCallExpression(call, call.Expression, call.QuestionDotToken, call.TypeArguments, tx.Factory().NewNodeList(arguments), node.Flags)
	}
	return visitor.VisitNode(node)
}

// A recursive named generator is emitted as ({ *name() {...} }).name so
// its name does not shadow the source function's binding (names.go). A frame
// that joinFrames wrapped, runtime.$joinedFrame(generator), is its generator.
func iteratorGeneratorBody(node *ast.Node) *ast.Node {
	if ast.IsCallExpression(node) && len(node.Arguments()) == 1 && ast.IsPropertyAccessExpression(node.Expression()) && node.Expression().Name().Text() == "$joinedFrame" {
		node = node.Arguments()[0]
	}
	if ast.IsFunctionExpression(node) && node.AsFunctionExpression().AsteriskToken != nil {
		return node.Body()
	}
	if ast.IsPropertyAccessExpression(node) || ast.IsElementAccessExpression(node) {
		object := node.Expression()
		if ast.IsObjectLiteralExpression(object) && len(object.AsObjectLiteralExpression().Properties.Nodes) == 1 {
			method := object.AsObjectLiteralExpression().Properties.Nodes[0]
			if method.Kind == ast.KindMethodDeclaration && method.AsMethodDeclaration().AsteriskToken != nil {
				return method.Body()
			}
		}
	}
	return nil
}

func iteratorPauses(node *ast.Node) bool {
	if isFunctionBoundary(node) {
		return false
	}
	switch node.Kind {
	case ast.KindForOfStatement:
		loop := node.AsForInOrOfStatement()
		if containsYield(loop.Initializer) || containsYield(loop.Statement) {
			return true
		}
	case ast.KindArrayBindingPattern:
		if containsYield(node) {
			return true
		}
	case ast.KindBinaryExpression:
		binary := node.AsBinaryExpression()
		if binary.OperatorToken.Kind == ast.KindEqualsToken {
			left := ast.SkipParentheses(binary.Left)
			if (ast.IsArrayLiteralExpression(left) || ast.IsObjectLiteralExpression(left)) && assignmentHasArray(left) && containsYield(left) {
				return true
			}
		}
	}
	return node.ForEachChild(iteratorPauses)
}

// Only assignment-pattern structure matters here: an array literal in a
// computed key or a default expression does not itself own a live iterator.
func assignmentHasArray(node *ast.Node) bool {
	if ast.IsArrayLiteralExpression(node) {
		return true
	}
	if ast.IsObjectLiteralExpression(node) {
		for _, property := range node.AsObjectLiteralExpression().Properties.Nodes {
			if property.Kind == ast.KindPropertyAssignment && assignmentHasArray(property.Initializer()) {
				return true
			}
		}
	}
	if ast.IsBinaryExpression(node) && node.AsBinaryExpression().OperatorToken.Kind == ast.KindEqualsToken {
		return assignmentHasArray(node.AsBinaryExpression().Left)
	}
	return false
}
