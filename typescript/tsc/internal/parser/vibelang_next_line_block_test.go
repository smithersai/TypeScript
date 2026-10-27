package parser_test

import (
	"strings"
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/parser"
)

func TestVibeLangNextLineBlock(t *testing.T) {
	for _, previous := range []string{
		"once", "object.once", `withSpan("x")`, "return once", "return object.once", "return once()",
		"throw reason", "throw object.reason", "throw reason()", "const value = once", "let first = 0, last = once()",
		"var value = object.once", "using value = open()", "once() /* ; is only a comment */", "once() // trailing comment",
	} {
		for _, list := range []string{"function f() { BEFORE\n  {} }", "BEFORE\n{}", "switch (x) { case 0: BEFORE\n{} }", "switch (x) { default: BEFORE\n{} }"} {
			source := strings.ReplaceAll(list, "BEFORE", previous)
			t.Run(source, func(t *testing.T) {
				file := parser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/main.vibe", PathKey: "/main.vibe"}, source, core.ScriptKindTS)
				items := file.Diagnostics()
				if len(items) != 1 || items[0].Source() != "EK" || items[0].Code() != 1022 || source[items[0].Pos():items[0].End()] != "{" {
					t.Fatalf("want EK1022 on {, got %v", items)
				}
			})
		}
	}
	for _, source := range []string{
		"once;\n{}", "once() /* comment */;\n{}", "const value = once;\n{}", "const first = once, last = 0\n{}",
		"const value = []\n{}", "const value = 0\n{}", "const value = {}\n{}", "const value = () => {}\n{}",
		"once?.()\n{}", "object?.once\n{}", "object[once]\n{}", "once!\n{}",
		"function f() { return\n{} }", "function f() { once { return 1 } }", "{}\n{}", "once\n;\n{}",
		"function f() {\n once()\n}", "if (once())\n{}\nelse\n{}", "while (once())\n{}", "do\n{} while (once())",
		"for (; once();)\n{}", "for (const x of once())\n{}", "for (const x in once())\n{}",
		"try\n{} catch (e)\n{} finally\n{}", "label:\n{}", "class C extends once()\n{}",
		"module js { export function f() { once()\n{} } }",
	} {
		t.Run(source, func(t *testing.T) {
			file := parser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/main.vibe", PathKey: "/main.vibe"}, source, core.ScriptKindTS)
			if len(file.Diagnostics()) != 0 {
				t.Fatalf("valid source rejected: %v", file.Diagnostics())
			}
		})
	}
	file := parser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/main.ts", PathKey: "/main.ts"}, "once()\n{}", core.ScriptKindTS)
	if len(file.Diagnostics()) != 0 {
		t.Fatalf("TypeScript rejected: %v", file.Diagnostics())
	}
}
