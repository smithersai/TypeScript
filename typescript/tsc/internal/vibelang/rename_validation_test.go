package vibelang

import (
	"strings"
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/ls/lsconv"
	"github.com/microsoft/TypeScript/tsc/internal/lsp/lsproto"
)

func TestEditorRenameValidatesNewIdentifier(t *testing.T) {
	for _, tc := range []struct {
		name, source, old, next string
		want                    bool
	}{
		{"digit", "export function nameOf() { return 1 }\nexport const value = nameOf()", "nameOf", "1x", false},
		{"hyphen", "export function nameOf() { return 1 }\nexport const value = nameOf()", "nameOf", "bad-name", false},
		{"empty", "export const value = 1", "value", "", false},
		{"spaces", "export const value = 1", "value", "bad name", false},
		{"keyword", "export const value = 1", "value", "class", false},
		{"contextual keyword", "export const value = 1", "value", "type", true},
		{"unicode", "export const value = 1", "value", "名", true},
		{"dollar", "export const value = 1", "value", "$value", true},
		{"property keyword", "export const obj = { value: 1 }; obj.value", "value", "class", true},
		{"property syntax", "export const obj = { value: 1 }; obj.value", "value", "bad-name", false},
		{"string property", "export const obj = { 'old-key': 1 }; obj['old-key']", "old-key", "new-key", true},
		{"private", "class C { #value = 1; read() { return this.#value } }", "#value", "#next", true},
		{"invalid private", "class C { #value = 1; read() { return this.#value } }", "#value", "#bad-name", false},
		{"label", "outer: for (;;) { break outer }", "outer", "bad-name", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			_, file, service, converters := editorProgram(t, tc.source)
			pos, _ := converters.ToLSPPosition(file, core.TextPos(strings.Index(tc.source, tc.old)))
			uri := lsconv.FileNameToDocumentURI(file.FileName())
			// Actual rename must validate even when prepareRename was never called.
			result, err := service.ProvideRename(t.Context(), &lsproto.RenameParams{
				TextDocument: lsproto.TextDocumentIdentifier{Uri: uri},
				Position:     pos, NewName: tc.next,
			}, nil)
			if err != nil {
				t.Fatal(err)
			}
			got := result.WorkspaceEdit != nil && result.WorkspaceEdit.Changes != nil && len(*result.WorkspaceEdit.Changes) > 0
			if got != tc.want {
				t.Fatalf("rename to %q returned edits=%v, want %v", tc.next, got, tc.want)
			}
		})
	}
}
