package vibelang

import (
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/diagnostics"
)

// D475: EK4842's quick fix imports Effect's module under another name and
// renames every reference to the import, and only those.
func TestGlobalImportQuickFixes(t *testing.T) {
	for _, test := range []struct{ name, source, want string }{
		{"a named import", "import { Array, Option } from \"effect\"\nexport function firstTwo(values: ReadonlyArray<number>) { return Array.take(values, 2) }\nexport const none = Option.none()\n",
			"import { Array as Arr, Option } from \"effect\"\nexport function firstTwo(values: ReadonlyArray<number>) { return Arr.take(values, 2) }\nexport const none = Option.none()\n"},
		{"a namespace import", "import * as String from \"effect/String\"\nexport const shout = (s: string) => String.toUpperCase(s)\n",
			"import * as Str from \"effect/String\"\nexport const shout = (s: string) => Str.toUpperCase(s)\n"},
		{"a shorthand property", "import { Number } from \"effect\"\nconst modules = { Number }\nexport const total = modules.Number.sum(1, 2)\n",
			"import { Number as Num } from \"effect\"\nconst modules = { Number: Num }\nexport const total = modules.Number.sum(1, 2)\n"},
		{"the short name taken", "import { Array } from \"effect\"\nconst Arr = [1]\nexport const n = Array.length(Arr)\n",
			"import { Array as EffectArray } from \"effect\"\nconst Arr = [1]\nexport const n = EffectArray.length(Arr)\n"},
		{"the global type stays", "import { Array } from \"effect\"\nexport function pair(a: number): Array<number> { return Array.of(a).concat([a]) }\n",
			"import { Array as Arr } from \"effect\"\nexport function pair(a: number): Array<number> { return Arr.of(a).concat([a]) }\n"},
		{"an inferred tuple", "import { Array } from \"effect\"\nexport const pair = (a: number) => Array.make(a, a)\n",
			"import { Array as Arr } from \"effect\"\nexport const pair = (a: number) => Arr.make(a, a)\n"},
		{"a local type", "import { Function } from \"effect\"\nfunction twice(n: number): number { return Function.pipe(n, (x) => x * 2) }\nexport const four = twice(2)\n",
			"import { Function as Fn } from \"effect\"\nfunction twice(n: number): number { return Fn.pipe(n, (x) => x * 2) }\nexport const four = twice(2)\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := applyQuickFix(t, test.source, EK4842.Code)
			if got != test.want {
				t.Fatalf("edited source differs:\ngot:\n%s\nwant:\n%s", got, test.want)
			}
			program, file, _, _ := editorProgram(t, got)
			for _, d := range append(program.GetSyntacticDiagnostics(t.Context(), file), program.GetSemanticDiagnostics(t.Context(), file)...) {
				if d.Category() == diagnostics.CategoryError || d.Source() == diagnosticSource && d.Code() == EK4842.Code {
					t.Errorf("the fixed source reports %s%d: %s", d.Source(), d.Code(), d.String())
				}
			}
		})
	}
}

// Where the rename would change the module's declaration file, or the import
// is not Effect's module under a global's name, EK4842 says nothing.
func TestGlobalImportNotReported(t *testing.T) {
	for _, test := range []struct{ name, source string }{
		{"another name already", "import { Array as Arr } from \"effect\"\nexport const n = Arr.length([1])\n"},
		{"no global's name", "import { Order } from \"effect\"\nexport const byNumber = Order.Number\n"},
		{"a re-export", "import { Array } from \"effect\"\nexport { Array }\n"},
		{"a default export", "import { Array } from \"effect\"\nexport default Array\n"},
		{"a written type in a local function", "import { Array } from \"effect\"\nfunction first(xs: Array.NonEmptyReadonlyArray<number>) { return xs[0] }\nexport const one = first([1])\n"},
		{"a written type of the module", "import { Array } from \"effect\"\nexport function first(xs: Array.NonEmptyReadonlyArray<number>) { return xs[0] }\n"},
		{"a type parameter's constraint", "import { Array } from \"effect\"\nexport function first<T extends Array.NonEmptyReadonlyArray<number>>(xs: T): number { return xs[0] }\n"},
		{"a type-only import", "import type { Array } from \"effect\"\nexport type Pair = Array.NonEmptyReadonlyArray<number>\n"},
		{"every name taken", "import { Array } from \"effect\"\nconst Arr = 1\nconst EffectArray = 2\nexport const n = Array.length([Arr, EffectArray])\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			program, file, _, _ := editorProgram(t, test.source)
			for _, d := range program.GetSemanticDiagnostics(t.Context(), file) {
				if d.Source() == diagnosticSource && d.Code() == EK4842.Code {
					t.Fatalf("unexpected EK4842: %s", d.String())
				}
			}
		})
	}
}
