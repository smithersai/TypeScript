package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/diagnostics"
	"strings"
	"testing"
)

func TestReturnedBlockFiberWarning(t *testing.T) {
	const prefix = "function one() { sleep(1); return 1 }\n"
	for _, test := range []struct {
		name, source string
		want         int
	}{
		{"direct", "export function fib(): Fiber<number>!! { return fork one() }", 1},
		{"binding", "export function fib() { const f = fork one(); return f }", 1},
		{"alias in object", "export function fib() { const f = fork one(); const alias = f; return { fiber: alias } }", 1},
		{"joined", "export function fib() { const f = fork one(); return join f }", 0},
		{"nested", "export function fib() { const f = fork one(); return () => f }", 0},
		{"detached", "export function fib() { return detach(one()) }", 0},
		{"disabled", "// @vibelang-diagnostics EK4838:off\nexport function fib() { return fork one() }", 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			program, file, _, _ := editorProgram(t, prefix+test.source)
			got := 0
			for _, d := range program.GetSemanticDiagnostics(t.Context(), file) {
				if d.Code() == 4838 {
					got++
					if d.Category() != diagnostics.CategoryWarning {
						t.Errorf("not a warning: %v", d)
					}
					if text := diagnosticWithNotes(d); !strings.Contains(text, "forkIn(scope, program)") || !strings.Contains(text, "detach(program)") {
						t.Errorf("missing lifetime guidance: %s", text)
					}
				}
			}
			if got != test.want {
				t.Fatalf("got %d warnings, want %d", got, test.want)
			}
		})
	}
	source := prefix + "export function fib() { return fork one() }"
	want := prefix + "export function fib() { return detach(one()) }"
	if got := applyQuickFix(t, source, 4838); got != want {
		t.Fatalf("fix: %s; want %s", got, want)
	}
}
