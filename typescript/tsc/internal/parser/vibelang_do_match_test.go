package parser_test

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/parser"
	"testing"
)

func TestVibeLangDoTailMatch(t *testing.T) {
	for _, text := range []string{
		"function f() { return do { match (0) { default: 2; } } }",
		"function f() { return do { if (true) match (0) { default: 2; }; else 3 } }",
		"function f() { return do { { match (0) { when 0: 2; default: 3; } } } }",
		"function f() { return do { match (0) { default: do { match (1) { default: 4; } }; } } }",
	} {
		file := parser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/test.vibe", PathKey: "/test.vibe"}, text, core.ScriptKindTS)
		if len(file.Diagnostics()) != 0 {
			t.Fatalf("valid completion rejected: %v\n%s", file.Diagnostics(), text)
		}
	}
}
