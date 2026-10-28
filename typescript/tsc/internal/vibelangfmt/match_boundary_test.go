package vibelangfmt_test

import (
	"context"
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/format"
	"github.com/microsoft/TypeScript/tsc/internal/ls/lsutil"
	"github.com/microsoft/TypeScript/tsc/internal/parser"
	"github.com/microsoft/TypeScript/tsc/internal/vibelangfmt"
	"testing"
)

func TestMatchStatementBoundary(t *testing.T) {
	for _, source := range []string{
		"function f() { return do { let n = 0\n match (n) { default: 2; } } }",
		"export function main() {\n  let n = 0\n  match (n) {\n    default: n = 1;\n  }\n}\n",
		"function f() { let n = 0; if (n === 0) match (n) { default: n = 1; } }",
		"function f() { return\n match (0) { default: 1; } }",
	} {
		t.Run(source, func(t *testing.T) {
			host := func(text string) (string, error) {
				file := parser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/test.ts", PathKey: "/test.ts"}, text, core.ScriptKindTS)
				ctx := format.WithFormatCodeSettings(context.Background(), lsutil.GetDefaultFormatCodeSettings(), "\n")
				return core.ApplyBulkEdits(text, format.FormatDocument(ctx, file)), nil
			}
			once, err := vibelangfmt.Format("test.vibe", source, host)
			if err != nil {
				t.Fatal(err)
			}
			twice, err := vibelangfmt.Format("test.vibe", once, host)
			if err != nil || once != twice {
				t.Fatalf("not idempotent: %q (%v)", twice, err)
			}
		})
	}
}
