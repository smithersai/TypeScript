package vibelang

import (
	"context"
	"strings"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/ls"
)

// Both repairs need the author's intent, so neither belongs in --fix.
var nextLineBlockFix = &ls.CodeFixProvider{
	Source:     diagnosticSource,
	ErrorCodes: []int32{EK1022.Code},
	GetCodeActions: func(_ context.Context, fix *ls.CodeFixContext) ([]*ls.CodeAction, error) {
		var previous *ast.Node
		var visit func(*ast.Node) bool
		visit = func(node *ast.Node) bool {
			switch node.Kind {
			case ast.KindSourceFile, ast.KindBlock, ast.KindCaseClause, ast.KindDefaultClause:
				statements := node.StatementList()
				for i, statement := range statements.Nodes {
					if i > 0 && ast.IsBlock(statement) && nodeStart(fix.SourceFile, statement) == fix.Span.Pos() {
						previous = statements.Nodes[i-1]
						return true
					}
				}
			}
			return node.ForEachChild(visit)
		}
		visit(fix.SourceFile.AsNode())
		if previous == nil {
			return nil, nil
		}
		end, brace := previous.End(), fix.Span.Pos()
		join := replaceRange(fix, end, brace+1, " {")
		if strings.TrimSpace(fix.SourceFile.Text()[end:brace]) != "" {
			// Move the brace before the trivia, keeping even line comments intact
			// inside the new body rather than deleting or commenting out code.
			join = append(replaceRange(fix, end, end, " {"), replaceRange(fix, brace, brace+1, "")...)
		}
		return []*ls.CodeAction{
			{Description: "Join the lines to pass the block param", Changes: join},
			{Description: "Add ; to keep the block statement", Changes: replaceRange(fix, end, end, ";")},
		}, nil
	},
}

func init() {
	ls.RegisterCodeFixProvider(nextLineBlockFix)
}
