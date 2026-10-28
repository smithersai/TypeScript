package vibelang

import (
	"reflect"
	"strings"
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/core"
)

// Each EK48xx rewrite candidate asks which import bindings its edits leave
// unused. The identifiers it counts come from one index per file and
// checker, so a file with n candidates is walked once, not n times.
func TestIdentifierUsesSharesOneIndex(t *testing.T) {
	var source strings.Builder
	source.WriteString("import { Data } from \"effect\"\n")
	for i := range 50 {
		source.WriteString("export type T" + string(rune('a'+i%26)) + string(rune('a'+i/26)) + " = Effect.Effect<Data.Data<{ n: number }>, never, never>\n")
	}
	program, file, _, _ := editorProgram(t, source.String())
	c, done := program.GetTypeCheckerForFile(t.Context(), file)
	defer done()
	first := identifierIndexOf(c, file)
	if second := identifierIndexOf(c, file); reflect.ValueOf(first).Pointer() != reflect.ValueOf(second).Pointer() {
		t.Fatal("a second request built another index")
	}
	names := map[string]bool{"Data": true, "Effect": true}
	at := strings.Index(file.Text(), "Effect.Effect")
	replaced := []core.TextRange{core.NewTextRange(at, at+len("Effect.Effect<Data.Data<{ n: number }>, never, never>"))}
	inside, outside := identifierUses(file, first, names, replaced)
	walkedInside, walkedOutside := identifierUses(file, nil, names, replaced)
	if !reflect.DeepEqual(inside, walkedInside) || !reflect.DeepEqual(outside, walkedOutside) {
		t.Fatalf("index counts %v %v, a walk %v %v", inside, outside, walkedInside, walkedOutside)
	}
	if inside["Data"] != 2 || outside["Data"] != 98 || inside["Effect"] != 2 || outside["Effect"] != 98 {
		t.Fatalf("counts inside %v, outside %v", inside, outside)
	}
}
