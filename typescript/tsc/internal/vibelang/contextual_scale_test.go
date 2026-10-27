package vibelang

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestNestedArrowContextualLookup(t *testing.T) {
	// Depth 25 took over twenty seconds when the Effect fallback repeated
	// the signature lookup. Leave ample room for loaded builders.
	for _, depth := range []int{10, 25, 50, 200} {
		program, file, _, _ := editorProgram(t, "export const f = "+strings.Repeat("() => ", depth)+"1\n")
		start := time.Now()
		diagnostics := program.GetSemanticDiagnostics(context.Background(), file)
		elapsed := time.Since(start)
		t.Logf("depth %d: %s", depth, elapsed)
		if elapsed > 5*time.Second {
			t.Fatalf("%d nested arrows took %s; want under 5s", depth, elapsed)
		}
		for _, d := range diagnostics {
			t.Errorf("unexpected diagnostic: %s", d.String())
		}
	}
}
