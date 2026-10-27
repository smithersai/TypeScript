package vibelang

import (
	"context"
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"github.com/microsoft/TypeScript/tsc/internal/ls"
	"github.com/microsoft/TypeScript/tsc/internal/lsp/lsproto"
)

var EK4838 = message(4838, warningCategory, "This returned fiber belongs to its block and is interrupted when the block exits.")

func init() {
	registry[EK4838.Code] = EK4838
	fileChecks = append(fileChecks, checkReturnedBlockFibers)
	ls.RegisterCodeFixProvider(returnedBlockFiberFix)
}

func checkReturnedBlockFibers(c *checker.Checker, file *ast.SourceFile) {
	a := analyzerFor(c)
	reported := map[*ast.Node]bool{}
	var visit func(*ast.Node) bool
	visit = func(node *ast.Node) bool {
		if ast.IsReturnStatement(node) && node.Expression() != nil && inLowerableBody(node) && !inHatch(node) {
			returnedFibers(c, node.Expression(), map[*ast.Symbol]bool{}, func(fork *ast.Node) {
				if reported[fork] || a.forkOwner(fork) == nil || ast.GetContainingFunction(fork) != ast.GetContainingFunction(node) {
					return
				}
				reported[fork] = true
				d := report(c, fork.Expression(), EK4838)
				note(d, "To keep a fiber alive past this block, use forkIn(scope, program) with a scope held by the caller, or detach(program) and arrange its shutdown: https://vibelang.sh/concurrency/047-fibers#selecting-scoped-or-detached-lifetimes")
			})
		}
		return node.ForEachChild(visit)
	}
	file.AsNode().ForEachChild(visit)
}

// Follow only values that a return actually hands out, through const aliases
// and aggregate values. Calls such as join(f) and closures are not fiber values.
func returnedFibers(c *checker.Checker, value *ast.Node, seen map[*ast.Symbol]bool, found func(*ast.Node)) {
	value = ast.SkipParentheses(value)
	switch {
	case ast.IsCallExpression(value):
		if analyzerFor(c).isPreludeFork(value) {
			found(value)
		}
	case ast.IsIdentifier(value):
		symbol := c.GetSymbolAtLocation(value)
		if symbol == nil || seen[symbol] {
			return
		}
		seen[symbol] = true
		decl := symbol.ValueDeclaration()
		if decl != nil && ast.IsVariableDeclaration(decl) && decl.Initializer() != nil && decl.Parent != nil && decl.Parent.Flags&ast.NodeFlagsConst != 0 {
			returnedFibers(c, decl.Initializer(), seen, found)
		}
	case ast.IsAsExpression(value), value.Kind == ast.KindTypeAssertionExpression, ast.IsNonNullExpression(value), ast.IsSatisfiesExpression(value):
		returnedFibers(c, value.Expression(), seen, found)
	case ast.IsConditionalExpression(value):
		conditional := value.AsConditionalExpression()
		returnedFibers(c, conditional.WhenTrue, seen, found)
		returnedFibers(c, conditional.WhenFalse, seen, found)
	case ast.IsArrayLiteralExpression(value):
		for _, element := range value.AsArrayLiteralExpression().Elements.Nodes {
			returnedFibers(c, element, seen, found)
		}
	case ast.IsObjectLiteralExpression(value):
		for _, property := range value.AsObjectLiteralExpression().Properties.Nodes {
			if ast.IsPropertyAssignment(property) {
				returnedFibers(c, property.Initializer(), seen, found)
			}
			if ast.IsShorthandPropertyAssignment(property) {
				symbol := c.GetShorthandAssignmentValueSymbol(property)
				if symbol != nil && !seen[symbol] {
					seen[symbol] = true
					if decl := symbol.ValueDeclaration(); decl != nil && ast.IsVariableDeclaration(decl) && decl.Initializer() != nil && decl.Parent.Flags&ast.NodeFlagsConst != 0 {
						returnedFibers(c, decl.Initializer(), seen, found)
					}
				}
			}
		}
	}
}

// Detaching changes lifetime, so it is an explicit editor action and is
// deliberately absent from the project's automatic --fix list.
var returnedBlockFiberFix = &ls.CodeFixProvider{
	Source:     diagnosticSource,
	ErrorCodes: []int32{4838},
	GetCodeActions: func(_ context.Context, fix *ls.CodeFixContext) ([]*ls.CodeAction, error) {
		var call *ast.Node
		var visit func(*ast.Node) bool
		visit = func(node *ast.Node) bool {
			if ast.IsCallExpression(node) && node.Expression().Loc.ContainsInclusive(fix.Span.Pos()) && node.Expression().Kind == ast.KindIdentifier && node.Expression().Text() == "fork" {
				call = node
				return true
			}
			return node.ForEachChild(visit)
		}
		fix.SourceFile.AsNode().ForEachChild(visit)
		if call == nil || len(call.Arguments()) != 1 {
			return nil, nil
		}
		program := call.Arguments()[0]
		text := expressionText(fix.SourceFile, program)
		if ast.IsArrowFunction(program) && program.Flags&ast.NodeFlagsReparsed != 0 {
			text = "() => " + expressionText(fix.SourceFile, program.Body())
		}
		return []*ls.CodeAction{{Description: "Write detach to keep the fiber alive past this block", Changes: []*lsproto.TextEdit{{Range: fix.LS.ToLSPRange(fix.SourceFile, tsFormSpan(fix.SourceFile, call)), NewText: "detach(" + text + ")"}}}}, nil
	},
}
