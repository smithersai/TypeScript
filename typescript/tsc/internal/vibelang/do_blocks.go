package vibelang

import (
	"context"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"github.com/microsoft/TypeScript/tsc/internal/ls"
	"github.com/microsoft/TypeScript/tsc/internal/scanner"
)

var EK1019 = message(1019, errorCategory, "{0} cannot leave or hoist out of a do expression. Use let instead of var, and keep break and continue inside the do expression.")

func init() {
	registry[EK1019.Code] = EK1019
	fileChecks = append(fileChecks, checkDoBlocks)
	ls.RegisterCodeFixProvider(&ls.CodeFixProvider{
		Source:     diagnosticSource,
		ErrorCodes: []int32{EK1019.Code},
		GetCodeActions: func(_ context.Context, fix *ls.CodeFixContext) ([]*ls.CodeAction, error) {
			if fix.SourceFile.Text()[fix.Span.Pos():fix.Span.End()] != "var" {
				return nil, nil
			}
			return []*ls.CodeAction{{Description: "Replace var with let", Changes: replaceRange(fix, fix.Span.Pos(), fix.Span.End(), "let")}}, nil
		},
	})
}

// The parser represents do with an invoked arrow whose arrow token is
// anchored on the source do keyword, unlike a source function's => token.
func isDoArrow(file *ast.SourceFile, node *ast.Node) bool {
	if node.Kind != ast.KindArrowFunction {
		return false
	}
	token := node.AsArrowFunction().EqualsGreaterThanToken
	r := scanner.GetRangeOfTokenAtPosition(file, token.Pos())
	return file.Text()[r.Pos():r.End()] == "do"
}

func checkDoBlocks(c *checker.Checker, file *ast.SourceFile) {
	var visit func(*ast.Node) bool
	visit = func(node *ast.Node) bool {
		switch node.Kind {
		case ast.KindVariableDeclarationList:
			if node.Flags&ast.NodeFlagsBlockScoped == 0 {
				for parent := node.Parent; parent != nil; parent = parent.Parent {
					if isDoArrow(file, parent) {
						reportAt(c, file, scanner.GetRangeOfTokenAtPosition(file, node.Pos()), EK1019, "var")
						break
					}
					if isFunctionBoundary(parent) {
						break
					}
				}
			}
		case ast.KindBreakStatement, ast.KindContinueStatement:
			for parent := node.Parent; parent != nil; parent = parent.Parent {
				if isDoArrow(file, parent) {
					keyword := scanner.GetRangeOfTokenAtPosition(file, node.Pos())
					reportAt(c, file, keyword, EK1019, file.Text()[keyword.Pos():keyword.End()])
					cover(c, node) // replaces TS1107 from the generated arrow boundary
					break
				}
				if isFunctionBoundary(parent) {
					break
				}
				if label := node.Label(); label != nil {
					if parent.Kind == ast.KindLabeledStatement && parent.Label().Text() == label.Text() {
						break
					}
				} else if ast.IsIterationStatement(parent, false) || node.Kind == ast.KindBreakStatement && parent.Kind == ast.KindSwitchStatement {
					break
				}
			}
		}
		return node.ForEachChild(visit)
	}
	file.AsNode().ForEachChild(visit)
}
