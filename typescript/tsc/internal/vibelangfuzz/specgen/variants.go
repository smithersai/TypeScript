package specgen

import (
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode"
)

// A Variant is a VibeLang print of a program that the specification declares
// equivalent to the base print: it must end with the same Outcome and trace
// (EMI, Le et al., PLDI 2014).
type Variant struct {
	Name, Spec, Source string
}

// Variants prints the metamorphic variants of a program. Bytes after the
// generator's choices place the dead code and pick the extracted statements.
// A variant feature that leaveOut names, such as "pipe-self-call", is left
// out.
func Variants(p *Program, data []byte, leaveOut map[string]bool) []Variant {
	pipeSelf := !leaveOut["pipe-self-call"]
	tryDo := !leaveOut["annot-try-do"]
	c := &chooser{data: data}
	var out []Variant
	add := func(name, spec string, src string) {
		out = append(out, Variant{Name: name, Spec: spec, Source: src})
	}
	add("annot-bang", "Ch 2 Writing the contract yourself, Ch 14: a written A!E!R that equals the inferred contract changes nothing", PrintVibe(p, VibeOptions{Annot: "bang", AnnotTryDo: tryDo}))
	add("annot-effect", "Ch 2, Ch 14, D309: Effect<A, E, R> is A!E!R, an omitted argument never", PrintVibe(p, VibeOptions{Annot: "effect", AnnotTryDo: tryDo}))
	add("pipe", "Ch 5 The pipe operator, Ch 13 rule E6 (D325): x |> f(%, y) is f(x, y)", PrintVibe(p, VibeOptions{Pipe: true, PipeSelf: pipeSelf}))
	if holds(p, func(x Expr) bool { _, ok := x.(*CatchExpr); return ok }) {
		add("catch-do", "Ch 17 catch rule (D236): a catch expression is try { x } catch (e) { ... } as an expression; Ch 13 Blocks as values (D187)", PrintVibe(p, VibeOptions{CatchDo: true}))
	}
	if holds(p, func(x Expr) bool { _, ok := x.(*SvcCall); return ok }) {
		add("service-impl", "Ch 4 Using a service, Ch 13 rule E3: S.m(args) is S().m(args)", PrintVibe(p, VibeOptions{ServiceImpl: true}))
	}
	rename := renameMap(p)
	add("rename", "Ch 13 rule H7 (D328): renaming a binding consistently, to any name TypeScript allows, never changes what a program does", PrintVibe(p, VibeOptions{Rename: rename}))
	add("emi", "Ch 13 rule E4, E11: code under a condition the program never takes is never evaluated", PrintVibe(withDeadCode(p, c), VibeOptions{}))
	if q := extracted(p, c); q != nil {
		add("extract", "Ch 2 Calling runs the function, Ch 13 rule E9: a call runs the callee's statements where it stands", PrintVibe(q, VibeOptions{}))
	}
	add("combined", "the variants above compose: each is an equivalence", PrintVibe(p, VibeOptions{Annot: "effect", AnnotTryDo: tryDo, Pipe: true, PipeSelf: pipeSelf, CatchDo: true, ServiceImpl: true, Rename: rename}))
	return out
}

// walkProgram calls fn for every statement and expression of the program.
func walkProgram(p *Program, stmt func(Stmt), expr func(Expr)) {
	for _, f := range p.Funcs {
		walkStmts(f.Body, stmt, expr)
	}
}

func walkStmts(ss []Stmt, stmt func(Stmt), expr func(Expr)) {
	for _, s := range ss {
		walkStmt(s, stmt, expr)
	}
}

func walkStmt(s Stmt, stmt func(Stmt), expr func(Expr)) {
	if stmt != nil {
		stmt(s)
	}
	e := func(x Expr) { walkExpr(x, stmt, expr) }
	c := func(c *Cond) {
		if c != nil {
			e(c.L)
			e(c.R)
		}
	}
	switch s := s.(type) {
	case *Let:
		e(s.Init)
	case *Assign:
		e(s.Value)
	case *Trace:
		for _, v := range s.Values {
			e(v)
		}
	case *If:
		c(s.C)
	case *Return:
		e(s.Value)
	case *Throw:
		e(s.Err)
	case *ExprStmt:
		e(s.X)
	case *UsingBlock:
		for _, r := range s.Res {
			e(r.Arg)
		}
	case *Provide:
		for _, pr := range s.Providers {
			walkStmts(pr.Impl.Setup, stmt, expr)
			for _, m := range pr.Impl.Methods {
				walkStmts(m.Body, stmt, expr)
			}
		}
	case *Handle:
		walkStmts(s.Clause, stmt, expr)
		c(s.Abort)
		e(s.AbortValue)
		e(s.Resume)
	case *Fork:
		e(s.Call)
	case *Await:
		for _, el := range s.Elems {
			e(el.X)
			walkStmts(el.Body, stmt, expr)
			e(el.Value)
		}
	case *ForOfProducer:
		for _, a := range s.Args {
			e(a)
		}
	case *Yield:
		e(s.Value)
	case *UsingDecl:
		e(s.Res.Arg)
	case *JoinAll:
		for _, f := range s.Elems {
			e(f.Call)
		}
	case *Lifetime:
		e(s.Call)
		e(s.Result)
	case *ExitIs:
		e(s.Call)
	}
	forEachBlock(s, func(b []Stmt) { walkStmts(b, stmt, expr) })
}

func walkExpr(x Expr, stmt func(Stmt), expr func(Expr)) {
	if x == nil {
		return
	}
	if expr != nil {
		expr(x)
	}
	e := func(x Expr) { walkExpr(x, stmt, expr) }
	c := func(c *Cond) {
		if c != nil {
			e(c.L)
			e(c.R)
		}
	}
	switch x := x.(type) {
	case *Bin:
		e(x.L)
		e(x.R)
	case *Ternary:
		c(x.C)
		e(x.T)
		e(x.F)
	case *Call:
		for _, a := range x.Args {
			e(a)
		}
	case *SvcCall:
		for _, a := range x.Args {
			e(a)
		}
	case *CtlCall:
		for _, a := range x.Args {
			e(a)
		}
	case *CatchExpr:
		e(x.X)
		e(x.Handler)
	case *Match:
		e(x.Subject)
		for _, a := range x.Arms {
			c(a.Guard)
			e(a.Body)
			if a.Throw != nil {
				e(a.Throw)
			}
		}
		e(x.Default)
	case *Do:
		walkStmts(x.Body, stmt, expr)
		e(x.Value)
	case *Pipe:
		e(x.Head)
		for _, st := range x.Stages {
			e(st)
		}
	case *ThrowExpr:
		e(x.Left)
		e(x.Err)
	case *Maybe:
		c(x.C)
		e(x.V)
	case *ErrNew:
		for _, f := range x.Fields {
			e(f)
		}
	case *Sync:
		for _, i := range x.Inputs {
			e(i)
		}
	case *TryHatch:
		e(x.Input)
		e(x.Err)
	case *OptionNew:
		c(x.C)
		e(x.V)
	case *DataNew:
		for _, f := range x.Fields {
			e(f)
		}
	case *ExitTag:
		e(x.Call)
	case *Paren:
		e(x.X)
	}
}

func holds(p *Program, pred func(Expr) bool) bool {
	found := false
	walkProgram(p, nil, func(x Expr) {
		if pred(x) {
			found = true
		}
	})
	return found
}

// declaredNames lists every binding a statement list declares, nested ones
// included.
func declaredNames(ss []Stmt) []string {
	var names []string
	walkStmts(ss, func(s Stmt) {
		switch s := s.(type) {
		case *Let:
			names = append(names, s.Name)
		case *For:
			names = append(names, s.Var)
		case *ForOf:
			names = append(names, s.Var)
		case *Try:
			names = append(names, s.CatchVar, s.ExitVar)
		case *UsingBlock:
			for _, r := range s.Res {
				names = append(names, r.Name)
			}
		case *Handle:
			names = append(names, s.Param)
		case *Fork:
			names = append(names, s.Name)
		case *Await:
			names = append(names, s.Names...)
		case *ForConcurrent:
			names = append(names, s.Var)
		case *Retry:
			names = append(names, s.Name)
		case *MaskFork:
			names = append(names, s.Ready, s.Fiber)
		case *ForOfProducer:
			names = append(names, s.Var)
		case *MakeDeferred:
			names = append(names, s.Name)
		case *UsingDecl:
			names = append(names, s.Res.Name)
		case *JoinAll:
			names = append(names, s.Literal)
			names = append(names, s.Names...)
		case *Lifetime:
			names = append(names, s.Fiber, s.Scope, s.Ready, s.Value)
		case *ExitIs:
			names = append(names, s.Name, s.Bind)
		case *Provide:
			for _, pr := range s.Providers {
				for _, m := range pr.Impl.Methods {
					names = append(names, m.Param)
				}
				names = append(names, declaredNames(pr.Impl.Setup)...)
			}
		}
	}, func(x Expr) {
		switch x := x.(type) {
		case *CatchExpr:
			names = append(names, x.Var)
		case *Match:
			for _, a := range x.Arms {
				if a.GuardVar != "" {
					names = append(names, a.GuardVar)
				}
				if a.Case != "" {
					names = append(names, a.Binds...)
				}
			}
		}
	})
	return names
}

// referencedNames lists every local name a statement list reads or writes.
func referencedNames(ss []Stmt) []string {
	var names []string
	walkStmts(ss, func(s Stmt) {
		switch s := s.(type) {
		case *Assign:
			if !s.Counter {
				names = append(names, s.Name)
			}
		case *Rethrow:
			names = append(names, s.Var)
		case *IsIf:
			names = append(names, s.Var)
		case *MaskFork:
			names = append(names, s.Ready, s.Fiber)
		case *Signal:
			names = append(names, s.Ready)
		case *AwaitReady:
			names = append(names, s.Ready)
		case *Interrupt:
			names = append(names, s.Fiber)
		case *JoinAll:
			names = append(names, s.Fibers...)
			names = append(names, s.Literal)
		case *Lifetime:
			names = append(names, s.Fiber, s.Scope, s.Ready)
		case *ExitIs:
			names = append(names, s.Name, s.Bind)
		case *DataIs:
			names = append(names, s.Var)
		}
	}, func(x Expr) {
		switch x := x.(type) {
		case *DataField:
			names = append(names, x.Var)
		case *Reasons:
			names = append(names, x.Var)
		case *Ref:
			names = append(names, x.Name)
		case *DataRef:
			names = append(names, x.Name)
		case *TagLen:
			names = append(names, x.Var)
		case *ErrField:
			names = append(names, x.Var)
		case *Join:
			names = append(names, x.Fiber)
		case *TagOf:
			names = append(names, x.Var)
		}
	})
	return names
}

// renamePool holds names that a compiler's own output might use: generated
// bases, direct variants, temporaries and runtime names (Ch 13 rule H3: no
// identifier that TypeScript allows is reserved by VibeLang's output).
var renamePool = []string{"runtime", "Effect_1", "answer$direct", "$match1", "scope", "Users_base", "_this", "_arguments", "$direct", "self", "E0_base", "S0_base", "f1$direct", "$c1", "_a", "__b", "fiber_1", "exit_1", "$frame", "_value", "done", "cause_1", "$1", "yield_", "await_", "$runtime", "trace_1", "counter$", "_", "$"}

func hasDigit(s string) bool {
	return strings.IndexFunc(s, unicode.IsDigit) >= 0
}

// renameMap maps each local and parameter the generator named to a fresh
// name from renamePool, distinct from every name the program declares.
func renameMap(p *Program) map[string]string {
	taken := map[string]bool{}
	for _, f := range p.Funcs {
		taken[f.Name] = true
	}
	for _, e := range p.Errors {
		taken[e.Name] = true
	}
	for _, s := range p.Services {
		taken[s.Name] = true
	}
	var locals []string
	seen := map[string]bool{}
	note := func(n string) {
		if n != "" && hasDigit(n) && !seen[n] && !taken[n] {
			seen[n] = true
			locals = append(locals, n)
		}
	}
	for _, f := range p.Funcs {
		for _, prm := range f.Params {
			note(prm)
		}
		for _, n := range declaredNames(f.Body) {
			note(n)
		}
	}
	m := map[string]string{}
	used := map[string]bool{}
	i := 0
	for _, n := range locals {
		for {
			cand := renamePool[i%len(renamePool)]
			if i >= len(renamePool) {
				cand = fmt.Sprintf("%s_%d", cand, i/len(renamePool))
			}
			i++
			if !taken[cand] && !used[cand] {
				m[n] = cand
				used[cand] = true
				break
			}
		}
	}
	return m
}

// withDeadCode inserts, into each function's top-level body, statements under
// `trace.length < 0`, which no run makes true. The statements fail with
// nothing and need nothing, so contracts stay as they were.
func withDeadCode(p *Program, c *chooser) *Program {
	q := *p
	q.Funcs = nil
	g := &generator{c: *c, p: &q}
	if len(p.Datas) > 0 {
		// A data local declared before the dead code may be its subject.
		g.data = p.Datas[0]
	}
	for _, f := range p.Funcs {
		if f.Kind == kindProducer || f.Kind == kindAcquire || f.Kind == kindRelease || len(f.Body) == 0 {
			q.Funcs = append(q.Funcs, f)
			continue
		}
		at := 0
		if f == p.Main {
			at = 1 // after the reset
		}
		at += g.c.intn(len(f.Body) - at)
		// A plain function stays plain (Ch 15), so a plain-annotated caller
		// stays valid: only an Effect function's dead code runs an Effect.
		ctx := gctx{fn: f, vars: slices.Clone(f.Params), plain: true, dead: !f.Plain, ret: true, mult: 1}
		for _, s := range f.Body[:at] {
			g.declared(&ctx, s)
		}
		dead := &If{C: &Cond{Op: "<", L: &TraceLen{}, R: &Num{0}}, Then: g.stmts(ctx, 1+g.c.intn(3))}
		nf := *f
		nf.Body = slices.Insert(slices.Clone(f.Body), at, Stmt(dead))
		q.Funcs = append(q.Funcs, &nf)
		if f == p.Main {
			q.Main = &nf
		}
	}
	*c = g.c
	return &q
}

// extracted moves a run of one function's top-level statements into a new
// function that the original calls in their place. The run returns from
// nothing and jumps nowhere, reads no local declared before it, and declares
// no local read after it.
func extracted(p *Program, c *chooser) *Program {
	var candidates []*Func
	for _, f := range p.Funcs {
		if f.Kind == kindNormal && !f.Recursive && f != p.Main && len(f.Body) > 1 {
			candidates = append(candidates, f)
		}
	}
	if len(candidates) == 0 {
		return nil
	}
	f := candidates[c.intn(len(candidates))]
	body := f.Body
	for tries := 0; tries < 8; tries++ {
		start := c.intn(len(body) - 1)
		end := start + 1 + c.intn(len(body)-1-start)
		run := body[start:end]
		if !extractable(f, body, start, end) {
			continue
		}
		helper := &Func{Name: f.Name + "$part", Params: slices.Clone(f.Params), Body: slices.Clone(run), Kind: kindNormal}
		p.inferFunc(helper)
		var args []Expr
		for _, prm := range f.Params {
			args = append(args, &Ref{prm})
		}
		nf := *f
		nf.Body = append(append(slices.Clone(body[:start]), &ExprStmt{X: &Call{Fn: helper, Args: args}}), body[end:]...)
		q := *p
		q.Funcs = nil
		for _, g := range p.Funcs {
			if g == f {
				q.Funcs = append(q.Funcs, helper, &nf)
			} else {
				q.Funcs = append(q.Funcs, g)
			}
		}
		return &q
	}
	return nil
}

func extractable(f *Func, body []Stmt, start, end int) bool {
	run := body[start:end]
	jumps := false
	walkStmts(run, func(s Stmt) {
		switch s := s.(type) {
		case *Return, *Break, *Continue, *Yield, *Handle:
			jumps = true
		case *UsingDecl:
			// The region that owns a using declaration or a held fiber
			// releases it when it exits (Ch 7 Ownership, D408), so moving
			// it into a function of its own would end it earlier.
			jumps = true
		case *Fork:
			if heldBody(s.Block) {
				jumps = true
			}
		}
	}, nil)
	if jumps {
		return false
	}
	before := declaredNames(body[:start])
	for _, n := range referencedNames(run) {
		if slices.Contains(before, n) {
			return false
		}
	}
	inRun := declaredNames(run)
	for _, n := range referencedNames(body[end:]) {
		if slices.Contains(inRun, n) {
			return false
		}
	}
	return true
}

// heldBody reports whether a fork's block waits in Effect.never(), so only
// an interruption ends it.
func heldBody(ss []Stmt) bool {
	found := false
	walkStmts(ss, func(s Stmt) {
		if _, ok := s.(*Never); ok {
			found = true
		}
	}, nil)
	return found
}

// Declarations: the type oracle reads each exported function's contract from
// the emitted .d.ts, which writes an Effect type as Effect.Effect<A, E, R>
// (Ch 27 Declarations and the ABI, rule 4).

var dtsFunction = regexp.MustCompile(`export declare function (\w+)\([^)]*\): ([^;\n]+);`)

// A Declared is an exported function's declared return type: an Effect with
// its E and R members, or a plain type.
type Declared struct {
	Plain  bool
	Stream bool
	A      string
	E, R   NameSet
}

// DeclaredContracts reads each exported function's declared return type.
func DeclaredContracts(dts string) map[string]Declared {
	out := map[string]Declared{}
	for _, m := range dtsFunction.FindAllStringSubmatch(dts, -1) {
		name, ret := m[1], m[2]
		// Effect subpath imports name the type directly, unlike a root
		// namespace import (Chapter 27 rule 4 permits standard TypeScript).
		ret = strings.ReplaceAll(ret, `import("effect/Stream").Stream<`, "Stream.Stream<")
		ret = strings.ReplaceAll(ret, `import("effect/Effect").Effect<`, "Effect.Effect<")
		ret = importPrefix.ReplaceAllString(ret, "")
		rest, ok := strings.CutPrefix(ret, "Effect.Effect<")
		stream := false
		if !ok {
			rest, stream = strings.CutPrefix(ret, "Stream.Stream<")
		}
		if !ok && !stream {
			out[name] = Declared{Plain: true, A: ret}
			continue
		}
		args := typeArgs(rest)
		d := Declared{Stream: stream, E: NameSet{}, R: NameSet{}}
		if len(args) > 0 {
			d.A = args[0]
		}
		if len(args) > 1 {
			d.E = unionMembers(args[1])
		}
		if len(args) > 2 {
			d.R = unionMembers(args[2])
		}
		out[name] = d
	}
	return out
}

// typeArgs splits the text after a "<" into its top-level type arguments.
func typeArgs(s string) []string {
	depth := 0
	start := 0
	var args []string
	for i, ch := range s {
		switch ch {
		case '<', '(', '[', '{':
			depth++
		case ')', ']', '}':
			depth--
		case '>':
			if depth == 0 {
				return append(args, strings.TrimSpace(s[start:i]))
			}
			depth--
		case ',':
			if depth == 0 {
				args = append(args, strings.TrimSpace(s[start:i]))
				start = i + 1
			}
		}
	}
	return args
}

var importPrefix = regexp.MustCompile(`import\("[^"]*"\)\.`)

func unionMembers(t string) NameSet {
	s := NameSet{}
	for _, part := range strings.Split(importPrefix.ReplaceAllString(t, ""), "|") {
		part = strings.TrimSpace(part)
		if part != "" && part != "never" {
			s.add(part)
		}
	}
	return s
}

// NormalizeErrors drops a class whose base the set also holds: as a type,
// `Base | Sub` is `Base` (Ch 3 families).
func NormalizeErrors(p *Program, s NameSet) NameSet {
	out := NameSet{}
	for n := range s {
		subsumed := false
		for _, e := range p.Errors {
			if e.Name == n {
				for b := e.Base; b != nil; b = b.Base {
					if s[b.Name] {
						subsumed = true
					}
				}
			}
		}
		if !subsumed {
			out.add(n)
		}
	}
	return out
}
