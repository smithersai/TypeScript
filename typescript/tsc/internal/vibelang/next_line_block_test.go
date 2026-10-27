package vibelang

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/bundled"
	"github.com/microsoft/TypeScript/tsc/internal/diagnostics"
	"github.com/microsoft/TypeScript/tsc/internal/ls/lsconv"
	"github.com/microsoft/TypeScript/tsc/internal/lsp/lsproto"
	"github.com/microsoft/TypeScript/tsc/internal/vfs/osvfs"
)

func TestNextLineBlockQuickFixes(t *testing.T) {
	const prefix = "// café 😀\nfunction once(program?: () => void): void { if (program) program() }\n"
	for _, test := range []struct{ source, joined, separated string }{
		{"function f() { return once\n  {} }", "function f() { return once {} }", "function f() { return once;\n  {} }"},
		{"function f() { once()\n  {} }", "function f() { once() {} }", "function f() { once();\n  {} }"},
		{"function f() { const value = once\n  {} }", "function f() { const value = once {} }", "function f() { const value = once;\n  {} }"},
		{"once()\n{}", "once() {}", "once();\n{}"},
		{"switch (0) { case 0: once()\n{} }", "switch (0) { case 0: once() {} }", "switch (0) { case 0: once();\n{} }"},
		{"switch (0) { default: once()\n{} }", "switch (0) { default: once() {} }", "switch (0) { default: once();\n{} }"},
		{"function f() { once() // keep\n  {} }", "function f() { once() { // keep\n  } }", "function f() { once(); // keep\n  {} }"},
		{"function f() { once()\n  /* keep */\n  {} }", "function f() { once() {\n  /* keep */\n  } }", "function f() { once();\n  /* keep */\n  {} }"},
		{"function f() { once()\r\n\r\n  {} }", "function f() { once() {} }", "function f() { once();\r\n\r\n  {} }"},
	} {
		t.Run(test.source, func(t *testing.T) {
			program, file, service, converters := editorProgram(t, prefix+test.source)
			items := program.GetSyntacticDiagnostics(t.Context(), file)
			if len(items) != 1 || items[0].Source() != "EK" || items[0].Code() != EK1022.Code {
				t.Fatalf("want one EK1022, got %v", items)
			}
			d := lsconv.DiagnosticToLSPPush(t.Context(), converters, items[0])
			only := []lsproto.CodeActionKind{lsproto.CodeActionKindQuickFix}
			response, err := service.ProvideCodeActions(t.Context(), &lsproto.CodeActionParams{
				TextDocument: lsproto.TextDocumentIdentifier{Uri: lsconv.FileNameToDocumentURI(file.FileName())},
				Range:        d.Range, Context: &lsproto.CodeActionContext{Diagnostics: []*lsproto.Diagnostic{d}, Only: &only},
			})
			if err != nil {
				t.Fatal(err)
			}
			want := map[string]string{"Join the lines to pass the block param": prefix + test.joined, "Add ; to keep the block statement": prefix + test.separated}
			if response.CommandOrCodeActionArray != nil {
				for _, action := range *response.CommandOrCodeActionArray {
					if action.CodeAction == nil {
						continue
					}
					chosen := action.CodeAction
					expected, ok := want[chosen.Title]
					if !ok {
						continue
					}
					if chosen.Edit == nil || chosen.Edit.Changes == nil || len(*chosen.Edit.Changes) != 1 {
						t.Fatalf("invalid edit: %+v", chosen)
					}
					got := applyEditorEdits(t, file, converters, (*chosen.Edit.Changes)[lsconv.FileNameToDocumentURI(file.FileName())])
					if got != expected {
						t.Fatalf("%s:\ngot %s\nwant %s", chosen.Title, got, expected)
					}
					checked, edited, _, _ := editorProgram(t, got)
					for _, after := range append(checked.GetSyntacticDiagnostics(t.Context(), edited), checked.GetSemanticDiagnostics(t.Context(), edited)...) {
						if after.Category() == diagnostics.CategoryError {
							t.Errorf("quick fix left an error: %s", after.String())
						}
					}
					delete(want, chosen.Title)
				}
			}
			if len(want) != 0 {
				t.Fatalf("missing quick fixes: %v", want)
			}
		})
	}
}

func TestNextLineBlockNotAutoFixed(t *testing.T) {
	dir, config := fixFiles(t)
	source := "function once(program: () => string!!) { return program() }\nexport function f() { return once\n{ return \"x\" } }\n"
	name := filepath.Join(dir, "hazard.vibe")
	if err := os.WriteFile(name, []byte(source), 0o600); err != nil {
		t.Fatal(err)
	}
	result := FixProject(t.Context(), bundled.WrapFS(osvfs.FS()), bundled.LibPath(), config)
	for _, changed := range result.Order {
		if strings.HasSuffix(changed.AsString(), "/hazard.vibe") {
			t.Fatal("--fix chose an intent for EK1022")
		}
	}
}
