package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// Evaluation order (chapter 13). JavaScript evaluates an expression's
// operands left to right, each once, and skips what &&, ||, ??, a conditional
// and ?. skip. A lowering may move an operand, such as a pipe's left side
// into the place of its topic (pipes_lower.go), only past operands that
// stableValue says can neither run code nor change.

// stableValue reports whether node may be evaluated anywhere among the
// operands of its expression: a literal, this, a function or arrow
// expression, or a name that cannot be assigned (a const, function, class,
// enum, namespace or an import of one of them), or such a member of a
// namespace or enum. A let or a parameter can be assigned by another operand,
// and reading another property can run a getter.
func stableValue(c *checker.Checker, node *ast.Node) bool {
	node = ast.SkipOuterExpressions(node, ast.OEKParentheses|ast.OEKAssertions)
	switch node.Kind {
	case ast.KindNumericLiteral, ast.KindBigIntLiteral, ast.KindStringLiteral, ast.KindNoSubstitutionTemplateLiteral,
		ast.KindRegularExpressionLiteral, ast.KindTrueKeyword, ast.KindFalseKeyword, ast.KindNullKeyword, ast.KindThisKeyword,
		ast.KindFunctionExpression, ast.KindArrowFunction:
		return true
	case ast.KindIdentifier:
		symbol := c.GetSymbolAtLocation(node)
		if node.Text() == "undefined" && (symbol == nil || len(symbol.Declarations()) == 0) {
			return true // the global, which strict code cannot assign
		}
		return stableSymbol(c, symbol)
	case ast.KindPropertyAccessExpression:
		return node.QuestionDotToken() == nil && isNamespaceValue(c, node.Expression()) && stableSymbol(c, c.GetSymbolAtLocation(node.Name()))
	}
	return false
}

// stableSymbol reports whether a name that resolves to symbol always reads
// the same value without running code.
func stableSymbol(c *checker.Checker, symbol *ast.Symbol) bool {
	if symbol == nil {
		return false
	}
	symbol = checker.SkipAlias(symbol, c)
	flags := symbol.Flags()
	switch {
	case flags&ast.SymbolFlagsAccessor != 0:
		return false
	case flags&(ast.SymbolFlagsFunction|ast.SymbolFlagsClass|ast.SymbolFlagsEnum|ast.SymbolFlagsValueModule|ast.SymbolFlagsEnumMember) != 0:
		return true // TypeScript rejects assigning these (TS2628 to TS2631)
	case flags&ast.SymbolFlagsVariable != 0:
		return c.IsReadonlySymbol(symbol) // a const
	}
	return false
}

// isNamespaceValue reports whether node names a namespace or an enum, whose
// members are bindings rather than properties another operand can replace.
func isNamespaceValue(c *checker.Checker, node *ast.Node) bool {
	node = ast.SkipOuterExpressions(node, ast.OEKParentheses|ast.OEKAssertions)
	if !ast.IsIdentifier(node) && !ast.IsPropertyAccessExpression(node) || !stableValue(c, node) {
		return false
	}
	symbol := c.GetSymbolAtLocation(node)
	if ast.IsPropertyAccessExpression(node) {
		symbol = c.GetSymbolAtLocation(node.Name())
	}
	if symbol == nil {
		return false
	}
	return checker.SkipAlias(symbol, c).Flags()&(ast.SymbolFlagsValueModule|ast.SymbolFlagsNamespaceModule|ast.SymbolFlagsEnum) != 0
}
