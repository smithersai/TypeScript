package vibelang

import (
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/diagnostics"
)

// D474: EK4841's quick fix writes a schema constant and the type alias just
// before it as one schema alias, which the parser writes back into the same
// two declarations.
func TestSchemaAliasQuickFixes(t *testing.T) {
	for _, test := range []struct{ name, source, want string }{
		{"literals", "export type Kind = typeof Kind.Type\nexport const Kind = Schema.Literals([\"persistent\", \"incognito\"])\nexport const k: Kind = \"incognito\"\n",
			"export schema Kind = \"persistent\" | \"incognito\"\nexport const k: Kind = \"incognito\"\n"},
		{"a keyword schema", "export type Id = typeof Id.Type\nexport const Id = Schema.String\n",
			"export schema Id = string\n"},
		{"a union of other schemas", "schema A { a: string }\ntype AB = typeof AB.Type\nconst AB = Schema.Union([A, Schema.Number, Schema.Null])\nexport const ab: AB = null\n",
			"schema A { a: string }\nschema AB = A | number | null\nexport const ab: AB = null\n"},
		{"an array of tuples", "export type Pairs = typeof Pairs.Type\nexport const Pairs = Schema.Array(Schema.Tuple([Schema.String, Schema.Number]))\n",
			"export schema Pairs = [string, number][]\n"},
		{"a record", "export type Counts = typeof Counts.Type\nexport const Counts = Schema.Record(Schema.String, Schema.Number)\n",
			"export schema Counts = Record<string, number>\n"},
		{"a named schema", "export type Count = typeof Count.Type\nexport const Count = Schema.FiniteFromString\n",
			"export schema Count = Schema.FiniteFromString\n"},
		{"comments outside", "// The kinds.\nexport type Kind = typeof Kind.Type\nexport const Kind = Schema.Literals([\"a\", \"b\"]) // two\n",
			"// The kinds.\nexport schema Kind = \"a\" | \"b\" // two\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			got := applyQuickFix(t, test.source, EK4841.Code)
			if got != test.want {
				t.Fatalf("edited source differs:\ngot:\n%s\nwant:\n%s", got, test.want)
			}
			program, file, _, _ := editorProgram(t, got)
			for _, d := range append(program.GetSyntacticDiagnostics(t.Context(), file), program.GetSemanticDiagnostics(t.Context(), file)...) {
				if d.Category() == diagnostics.CategoryError || d.Source() == diagnosticSource && d.Code() == EK4841.Code {
					t.Errorf("the fixed source reports %s%d: %s", d.Source(), d.Code(), d.String())
				}
			}
		})
	}
}

// Where a schema alias would say something else, or would change the
// module's declaration file, EK4841 says nothing.
func TestSchemaAliasNotReported(t *testing.T) {
	for _, test := range []struct{ name, source string }{
		// The declaration file lists an alias's type first.
		{"the constant before its type", "export const Kind = Schema.Literals([\"a\", \"b\"])\nexport type Kind = typeof Kind.Type\n"},
		{"a statement between", "export type Kind = typeof Kind.Type\nexport const other = 1\nexport const Kind = Schema.Literals([\"a\", \"b\"])\n"},
		{"JSDoc on the constant", "export type Kind = typeof Kind.Type\n/** The kinds. */\nexport const Kind = Schema.Literals([\"a\", \"b\"])\n"},
		{"JSDoc on the type", "/** The kinds. */\nexport type Kind = typeof Kind.Type\nexport const Kind = Schema.Literals([\"a\", \"b\"])\n"},
		{"another spelling of the type", "export type Kind = Schema.Schema.Type<typeof Kind>\nexport const Kind = Schema.Literals([\"a\", \"b\"])\n"},
		{"another export", "type Kind = typeof Kind.Type\nexport const Kind = Schema.Literals([\"a\", \"b\"])\nexport const k: Kind = \"a\"\n"},
		{"no type alias", "export const Kind = Schema.Literals([\"a\", \"b\"])\n"},
		// No schema alias writes the schema.
		{"a struct", "export type User = typeof User.Type\nexport const User = Schema.Struct({ id: Schema.String })\n"},
		{"a transformation", "export type Name = typeof Name.Type\nexport const Name = Schema.NullOr(Schema.String)\n"},
		{"a pipe", "export type Id = typeof Id.Type\nexport const Id = Schema.String.pipe(Schema.brand(\"Id\"))\n"},
		{"a comment inside", "export type Kind = typeof Kind.Type\nexport const Kind = Schema.Literals([\"a\", /* the other */ \"b\"])\n"},
		{"an annotation", "export type Kind = typeof Kind.Type\nexport const Kind: Schema.Literals<readonly [\"a\", \"b\"]> = Schema.Literals([\"a\", \"b\"])\n"},
		{"a schema alias already", "export schema Kind = \"a\" | \"b\"\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			program, file, _, _ := editorProgram(t, test.source)
			for _, d := range program.GetSemanticDiagnostics(t.Context(), file) {
				if d.Source() == diagnosticSource && d.Code() == EK4841.Code {
					t.Fatalf("unexpected EK4841: %s", d.String())
				}
			}
		})
	}
}
