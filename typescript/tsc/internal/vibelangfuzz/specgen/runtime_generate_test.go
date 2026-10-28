package specgen

import (
	"math/rand/v2"
	"strings"
	"testing"
)

// TestRuntimeModuleGraphs checks Chapter 26 Modules and Chapter 27 rule 1:
// actual sibling imports carry the exported call's A, E and R, with a cycle
// of imports and a bounded call chain through two or three modules.
func TestRuntimeModuleGraphs(t *testing.T) {
	random := rand.New(rand.NewPCG(17, 29))
	seen := map[int]bool{}
	for i := 0; i < 40 && len(seen) < 2; i++ {
		data := make([]byte, 100)
		data[0] = byte(FeatureIndex("module-graph"))
		for j := 7; j < len(data); j++ {
			data[j] = byte(random.IntN(256))
		}
		p := Generate(data, nil)
		seen[p.ModuleCount] = true
		files := PrintVibeFiles(p, VibeOptions{}, "main.vibe")
		if len(files) != p.ModuleCount {
			t.Fatalf("got %d files for %d modules", len(files), p.ModuleCount)
		}
		if !strings.Contains(files["main.vibe"], `from "./main_graph1.vibe"`) {
			t.Fatal("main does not import sibling")
		}
		if !strings.Contains(files["main_graph1.vibe"], `from "./main.vibe"`) || !strings.Contains(files["main_graph1.vibe"], "graphBase(p0)") {
			t.Fatal("sibling does not call back across the cycle")
		}
		for _, f := range p.Funcs {
			if f.Module == 0 {
				continue
			}
			if SuccessType(f) != "number" || !f.E["E0"] || !f.R["S0"] {
				t.Fatalf("lost cross-file contract: %+v", f)
			}
		}
	}
	if !seen[2] || !seen[3] {
		t.Fatalf("generator did not write both graph sizes: %v", seen)
	}
}

// TestRuntimeDeeperRegions guards the Chapter 2 control-flow generator's
// ability to nest past three while keeping multiplicative work bounded.
func TestRuntimeDeeperRegions(t *testing.T) {
	g := &generator{p: &Program{Enabled: map[string]bool{}, Used: map[string]bool{}}, c: chooser{data: []byte{2}}}
	ss := g.stmt(gctx{fn: &Func{}, plain: true, depth: 4, mult: 1})
	if _, ok := ss[0].(*If); !ok {
		t.Fatalf("depth four cannot produce a nested condition: %T", ss[0])
	}
}

// TestRuntimeSuccessTypes keeps a nested program's return out of its caller's
// A, while region returns still belong to that caller (Chapters 2 and 14).
func TestRuntimeSuccessTypes(t *testing.T) {
	returned := []Stmt{&Return{Value: &Num{1}}}
	for _, tc := range []struct {
		body []Stmt
		want string
	}{
		{[]Stmt{&Return{Value: &Num{1}}}, "number"},
		{[]Stmt{&Try{Body: returned}}, "number"},
		{[]Stmt{&Fork{Block: returned}}, "void"},
		{[]Stmt{&Retry{Body: returned}}, "void"},
		{nil, "void"},
	} {
		if got := SuccessType(&Func{Body: tc.body}); got != tc.want {
			t.Errorf("%T: got %s, want %s", tc.body, got, tc.want)
		}
	}
}
