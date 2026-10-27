package parser

import (
	"strings"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/diagnostics"
	"github.com/microsoft/TypeScript/tsc/internal/scanner"
)

// VibeLangNextLineBlockMessage is shared by the parser and EK registry.
const VibeLangNextLineBlockMessage = "This block starts a new statement, so it is not `{0}`'s block param. A block param starts on the same line as its call: join the lines, or end the statement with `;`."

// Only statement-list siblings participate. Bodies of control flow, labels,
// functions and classes never enter this check (D376, fable-11).
func (p *Parser) checkVibeLangNextLineBlock(kind ParsingContext, list []*ast.Node) {
	if p.token != ast.KindOpenBraceToken || len(list) == 0 || !p.hasPrecedingLineBreak() || !p.isVibeLangFile() {
		return
	}
	switch kind {
	case PCSourceElements, PCBlockStatements, PCSwitchClauseStatements:
	default:
		return
	}
	previous := list[len(list)-1]
	head := vibeLangStatementEnd(previous)
	if head == nil || head.End() != previous.End() || !isVibeLangBlockParamHead(head) {
		return // a written semicolon extends the statement past its expression
	}
	text := p.sourceText[scanner.SkipTrivia(p.sourceText, head.Pos()):head.End()]
	p.diagnostics = append(p.diagnostics, ast.NewExternalDiagnostic(nil, p.tokenRange(), "EK", diagnostics.CategoryError, 1022,
		strings.ReplaceAll(VibeLangNextLineBlockMessage, "{0}", text)))
	p.hasParseError = true
}

func vibeLangStatementEnd(statement *ast.Node) *ast.Node {
	switch statement.Kind {
	case ast.KindExpressionStatement, ast.KindReturnStatement, ast.KindThrowStatement:
		return statement.Expression()
	case ast.KindVariableStatement:
		declarations := statement.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes
		if len(declarations) != 0 {
			return declarations[len(declarations)-1].AsVariableDeclaration().Initializer
		}
	}
	return nil
}
