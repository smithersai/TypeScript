package specgen

import (
	"math/rand/v2"
	"os"
	"path/filepath"
	"strconv"
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

// TestDoBlocksStopAtTheNestingLimit keeps a do block, whose statements start
// expressions of their own depth, from nesting in do blocks without bound:
// the nightly campaign of 2026-10-29 found inputs of 3.5 kB whose do blocks
// nested more than 150 deep (TestProgramsGrowWithTheirInput).
func TestDoBlocksStopAtTheNestingLimit(t *testing.T) {
	for b := range 256 {
		g := &generator{p: &Program{Enabled: map[string]bool{"do-block": true}, Used: map[string]bool{}}, c: chooser{data: []byte{byte(b), 0, 0, 0}}}
		if x, ok := g.expr(gctx{fn: &Func{}, depth: nestingLimit, mult: 1}, 2).(*Do); ok {
			t.Fatalf("choice %d writes a do block past the nesting limit: %v", b, x)
		}
	}
}

// TestProgramsGrowWithTheirInput bounds what the campaign's inputs write. The
// Effect reading indents each nested do block's Effect.gen a level deeper, so
// it grows with the square of the nesting: unbounded do blocks made 3.5 kB
// write a reading of 2 MB and 3.1 MB, whose compiles outlasted the hang limit.
// Bounded, each byte writes about 25.
func TestProgramsGrowWithTheirInput(t *testing.T) {
	for _, corpus := range []string{"FuzzSpecPrograms/do-nesting-unbounded", "FuzzSpecVariants/do-nesting-unbounded"} {
		contents, err := os.ReadFile(filepath.Join("..", "testdata", "fuzz", filepath.FromSlash(corpus)))
		if err != nil {
			t.Fatal(err)
		}
		line := strings.TrimSpace(strings.TrimPrefix(string(contents), "go test fuzz v1\n"))
		data, err := strconv.Unquote(strings.TrimSuffix(strings.TrimPrefix(line, "[]byte("), ")"))
		if err != nil {
			t.Fatal(err)
		}
		p := Generate([]byte(data), nil)
		vibe, effect := len(PrintVibe(p, VibeOptions{})), len(PrintEffect(p))
		if vibe > 100*len(data) || effect > 100*len(data) {
			t.Errorf("%s: %d bytes write %d bytes of VibeLang and %d of its Effect reading", corpus, len(data), vibe, effect)
		}
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

// runtimeInputs returns n inputs that focus on feature, with every feature
// of the swarm mask enabled and the rest random.
func runtimeInputs(feature string, n int) [][]byte {
	random := rand.New(rand.NewPCG(3, 11))
	var out [][]byte
	for i := 0; i < n; i++ {
		data := make([]byte, 400)
		data[0] = byte(FeatureIndex(feature))
		for j := 1; j < len(data); j++ {
			data[j] = byte(random.IntN(256))
		}
		out = append(out, data)
	}
	return out
}

// TestRuntimeHeldRegion checks that the held-fiber focus writes, in one
// program, what Chapter 7 Ownership and Chapter 17's finalization rule
// order: a try region that owns a forked fiber holding a using resource
// and a finally, waits for it, and exits, with a catch and a finally around
// it; and that across inputs the fiber also waits under a mask with
// restore and the region also holds using declarations beside it.
func TestRuntimeHeldRegion(t *testing.T) {
	seen := map[string]bool{}
	for _, data := range runtimeInputs("held-fiber", 60) {
		p := Generate(data, nil)
		found := false
		walkStmts(p.Main.Body, func(s Stmt) {
			try, ok := s.(*Try)
			if !ok || try.Catch == nil || try.Finally == nil {
				return
			}
			for i, b := range try.Body {
				f, ok := b.(*Fork)
				if !ok || !heldBody(f.Block) {
					continue
				}
				hold := f.Block[0].(*Try)
				if hold.Finally == nil {
					continue
				}
				walkStmts(hold.Body, func(s Stmt) {
					if u, ok := s.(*UsingBlock); ok && len(u.Res) > 0 {
						found = true
					}
					if m, ok := s.(*Mask); ok && m.Restore != nil {
						seen["restore"] = true
					}
				}, nil)
				for j, d := range try.Body {
					if _, ok := d.(*UsingDecl); ok {
						seen[map[bool]string{true: "using before", false: "using after"}[j < i]] = true
					}
				}
			}
		}, nil)
		if !found {
			t.Fatalf("input %x holds no region with a held fiber:\n%s", data, PrintVibe(p, VibeOptions{}))
		}
	}
	for _, want := range []string{"restore", "using before", "using after"} {
		if !seen[want] {
			t.Errorf("no input writes a held fiber with %s", want)
		}
	}
}

// TestRuntimeCauseMix checks that the cause-mix focus writes each
// combination Chapter 17 Combining causes names: a failure and a defect in
// parallel await.all branches, one of them in an interrupted branch's
// finally (D305); a failure in a try block and a throw or a defect in its
// finally; and a joined fiber interrupted while its finally throws, which a
// catch recovers (D306).
func TestRuntimeCauseMix(t *testing.T) {
	seen := map[string]bool{}
	for _, data := range runtimeInputs("cause-mix", 60) {
		p := Generate(data, nil)
		walkStmts(p.Main.Body, func(s Stmt) {
			switch s := s.(type) {
			case *ExitIs:
				walkStmts(s.Body, func(s Stmt) {
					a, ok := s.(*Await)
					if !ok || a.Op != "all" {
						return
					}
					for _, el := range a.Elems {
						if heldBody(el.Body) {
							fin := el.Body[0].(*Try).Finally
							switch fin[len(fin)-1].(type) {
							case *Throw, *Die:
								seen["parallel"] = true
							}
						}
					}
				}, nil)
			case *Try:
				if len(s.Body) == 1 {
					if inner, ok := s.Body[0].(*Try); ok && inner.Finally != nil && s.Catch != nil {
						seen["finalizer"] = true
					}
					if x, ok := s.Body[0].(*ExprStmt); ok {
						if _, ok := x.X.(*Join); ok && s.Catch != nil {
							seen["joined"] = true
						}
					}
				}
			}
		}, nil)
	}
	for _, want := range []string{"parallel", "finalizer", "joined"} {
		if !seen[want] {
			t.Errorf("no cause-mix input writes the %s combination", want)
		}
	}
}
