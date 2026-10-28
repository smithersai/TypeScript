package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"github.com/microsoft/TypeScript/tsc/internal/scanner"
)

// A function declared in a .vibe file is not a constructor (Chapter 13, rule
// L6): new on one is EK1020, in place of TypeScript's TS7009, and through a
// cast or @ts-ignore, which EK codes ignore, where new returned the
// function's program. A class is the form that constructs.
//
//	function make() { return 1 }
//	const x = new make()   // EK1020: make is not a constructor
//
// A function of a module declaration's body or a hatch is TypeScript's, and
// keeps TypeScript's meaning.

// EK1020: new on a function declared in a .vibe file. {0} is the function.
var EK1020 = message(1020, errorCategory, "{0} is a function declared in a .vibe file, which is not a constructor, so new cannot call it.")

func init() {
	registry[EK1020.Code] = EK1020
	fileChecks = append(fileChecks, checkNewOfFunctions)
}

func checkNewOfFunctions(c *checker.Checker, file *ast.SourceFile) {
	var visit func(node *ast.Node) bool
	visit = func(node *ast.Node) bool {
		if isTypeScriptModule(node) || isHatchArgument(node) {
			return false
		}
		if ast.IsNewExpression(node) {
			if fn := vibeLangFunctionNamedBy(c, node.Expression()); fn != nil {
				name := scanner.GetTextOfNode(ast.SkipOuterExpressions(node.Expression(), ast.OEKAll))
				note(report(c, node, EK1020, name), "Declare a class, whose constructor runs as plain JavaScript, or call {0} without new.", name)
				// TS7009: the new expression's target has no construct signature;
				// TS2350: only a void function can be called with new.
				coverCodes(c, node, 7009, 2350)
			}
		}
		return node.ForEachChild(visit)
	}
	file.AsNode().ForEachChild(visit)
}

// vibeLangFunctionNamedBy returns the function that expr, a new expression's
// target, names through parentheses and casts, when a .vibe file declares it
// outside a module declaration's body: a function declaration, or a variable
// that a function expression or arrow initializes. It returns nil otherwise.
func vibeLangFunctionNamedBy(c *checker.Checker, expr *ast.Node) *ast.Node {
	expr = ast.SkipOuterExpressions(expr, ast.OEKAll)
	if !ast.IsIdentifier(expr) && !ast.IsPropertyAccessExpression(expr) {
		return nil
	}
	symbol := c.GetSymbolAtLocation(expr)
	if symbol != nil && symbol.Flags()&ast.SymbolFlagsAlias != 0 {
		symbol = c.GetAliasedSymbol(symbol)
	}
	if symbol == nil || symbol.Flags()&ast.SymbolFlagsClass != 0 {
		return nil
	}
	d := symbol.ValueDeclaration()
	if d == nil || !isVibeLangFile(ast.GetSourceFileOfNode(d)) || ast.FindAncestor(d, isTypeScriptModule) != nil {
		return nil
	}
	switch {
	case ast.IsFunctionDeclaration(d):
		return d
	case ast.IsVariableDeclaration(d) && d.Initializer() != nil:
		if initializer := ast.SkipParentheses(d.Initializer()); ast.IsFunctionExpression(initializer) || ast.IsArrowFunction(initializer) {
			return initializer
		}
	}
	return nil
}

// isTypeScriptModule reports whether node is a module declaration, module
// name { ... }, whose body is TypeScript, not a namespace.
func isTypeScriptModule(node *ast.Node) bool {
	return node.Kind == ast.KindModuleDeclaration && node.AsModuleDeclaration().Keyword == ast.KindModuleKeyword
}
