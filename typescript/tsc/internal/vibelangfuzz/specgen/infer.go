package specgen

// Contract inference over the program model, from Chapters 2-4 and 14: a
// function's E is what it throws plus what its callees can fail with, minus
// what it catches (Ch 3); its R is the services and controls it uses, minus
// those a provide block or a handler removes (Ch 4, Ch 9). The generator uses
// these contracts to stay valid (a match without default must cover what its
// try block raises, D346), the annotation variants write them, and the type
// oracle compares them with the emitted declarations (Ch 27 rule 4).

// effects is what a piece of code does: the failures it can raise, the
// services and controls it needs, whether it performs an Effect operation,
// and an estimate of the calls one evaluation makes.
type effects struct {
	E, R   NameSet
	Effect bool
	Cost   int
}

func newEffects() effects { return effects{E: NameSet{}, R: NameSet{}} }

func (e *effects) join(o effects) {
	e.E.union(o.E)
	e.R.union(o.R)
	e.Effect = e.Effect || o.Effect
	e.Cost += o.Cost
}

// inferer holds the classes a catch variable can be at a point, narrowed as
// TypeScript narrows it by `is` and by a match's arms (Ch 3, D214).
type inferer struct {
	prog   *Program
	vars   map[string][]*ErrorDecl
	fibers map[string]effects
	self   *Func
}

func newInferer(p *Program) *inferer {
	return &inferer{prog: p, vars: map[string][]*ErrorDecl{}, fibers: map[string]effects{}}
}

func (in *inferer) errorsNamed(set NameSet) []*ErrorDecl {
	var out []*ErrorDecl
	for _, e := range in.prog.Errors {
		if set[e.Name] {
			out = append(out, e)
		}
	}
	return out
}

func classNames(classes []*ErrorDecl) NameSet {
	s := NameSet{}
	for _, c := range classes {
		s.add(c.Name)
	}
	return s
}

// without removes every class at or below c, as an arm that names c removes
// it (D346): a class arm covers its class and every class below it.
func without(classes []*ErrorDecl, c *ErrorDecl) []*ErrorDecl {
	var out []*ErrorDecl
	for _, x := range classes {
		if !x.IsA(c) {
			out = append(out, x)
		}
	}
	return out
}

// inferFunc computes a function's contract. A self-recursive function's
// channels come from a fixpoint (Ch 14 Recursion, D52): the body is checked
// with the channels found so far until they stop growing.
func (p *Program) inferFunc(f *Func) {
	f.E, f.R = NameSet{}, NameSet{}
	f.Cost = 1
	for i := 0; i < 8; i++ {
		in := newInferer(p)
		in.self = f
		eff := in.stmts(f.Body)
		eff.E.union(f.E)
		eff.R.union(f.R)
		grew := !eff.E.Equal(f.E) || !eff.R.Equal(f.R)
		f.E, f.R = eff.E, eff.R
		f.Plain = !eff.Effect && len(eff.E) == 0 && len(eff.R) == 0 && f.Kind != kindProducer
		f.Cost = 1 + eff.Cost
		if f.Recursive {
			f.Cost *= 5
		}
		if !grew {
			break
		}
	}
}

// inferBlock is the contract of a piece of code being generated.
func (p *Program) inferBlock(self *Func, body []Stmt) effects {
	in := newInferer(p)
	in.self = self
	return in.stmts(body)
}

func (p *Program) inferExpr(self *Func, x Expr, vars map[string][]*ErrorDecl) effects {
	in := newInferer(p)
	in.self = self
	for k, v := range vars {
		in.vars[k] = v
	}
	return in.expr(x)
}

func (in *inferer) stmts(ss []Stmt) effects {
	eff := newEffects()
	for _, s := range ss {
		eff.join(in.stmt(s))
	}
	return eff
}

func (in *inferer) stmt(s Stmt) effects {
	eff := newEffects()
	switch s := s.(type) {
	case *Let:
		eff.join(in.expr(s.Init))
	case *Assign:
		eff.join(in.expr(s.Value))
	case *Trace:
		for _, v := range s.Values {
			eff.join(in.expr(v))
		}
	case *If:
		eff.join(in.cond(s.C))
		eff.join(in.stmts(s.Then))
		eff.join(in.stmts(s.Else))
	case *IsIf:
		saved := in.vars[s.Var]
		var inside []*ErrorDecl
		for _, c := range saved {
			if c.IsA(s.Class) {
				inside = append(inside, c)
			}
		}
		in.vars[s.Var] = inside
		eff.join(in.stmts(s.Then))
		// Then ends with a return, so after the if the variable is narrowed
		// to the classes the test rejects.
		in.vars[s.Var] = without(saved, s.Class)
	case *For:
		body := in.stmts(s.Body)
		body.Cost *= s.N
		eff.join(body)
	case *ForOf:
		body := in.stmts(s.Body)
		body.Cost *= len(s.Elems)
		eff.join(body)
	case *Return:
		if s.Value != nil {
			eff.join(in.expr(s.Value))
		}
	case *Throw:
		eff.join(in.expr(s.Err))
		eff.E.add(s.Err.Err.Name)
		eff.Effect = true
	case *Rethrow:
		eff.E.union(classNames(in.vars[s.Var]))
		eff.Effect = true
	case *ExprStmt:
		eff.join(in.expr(s.X))
	case *Die:
		eff.Effect = true
	case *Try:
		body := in.stmts(s.Body)
		if s.Catch != nil {
			saved, had := in.vars[s.CatchVar]
			in.vars[s.CatchVar] = in.errorsNamed(body.E)
			handler := in.stmts(s.Catch)
			if had {
				in.vars[s.CatchVar] = saved
			} else {
				delete(in.vars, s.CatchVar)
			}
			body.E = handler.E
			body.R.union(handler.R)
			body.Effect = body.Effect || handler.Effect
			body.Cost += handler.Cost
		}
		if s.Finally != nil {
			body.join(in.stmts(s.Finally))
		}
		eff.join(body)
	case *UsingBlock:
		for _, r := range s.Res {
			eff.join(in.expr(r.Arg))
			eff.join(in.call(r.Acq))
			eff.join(in.call(r.Rel))
		}
		eff.join(in.stmts(s.Body))
		eff.Effect = true
	case *Provide:
		body := in.stmts(s.Body)
		for _, p := range s.Providers {
			delete(body.R, p.Impl.Svc.Name)
		}
		for _, p := range s.Providers {
			body.join(in.stmts(p.Impl.Setup))
		}
		eff.join(body)
		eff.Effect = true
	case *Handle:
		body := in.stmts(s.Body)
		delete(body.R, s.Ctl.Name)
		eff.join(body)
		eff.join(in.stmts(s.Clause))
		if s.Abort != nil {
			eff.join(in.cond(s.Abort))
			eff.join(in.expr(s.AbortValue))
		}
		eff.join(in.expr(s.Resume))
		eff.Effect = true
	case *Fork:
		var prog effects
		if s.Call != nil {
			prog = in.expr(s.Call)
		} else {
			prog = in.stmts(s.Block)
		}
		in.fibers[s.Name] = prog
		eff.R.union(prog.R)
		eff.Cost += prog.Cost
		eff.Effect = true
	case *Await:
		for _, el := range s.Elems {
			var e effects
			if el.X != nil {
				e = in.expr(el.X)
			} else if !el.Never {
				e = in.stmts(el.Body)
				e.join(in.expr(el.Value))
			} else {
				e = newEffects()
			}
			if s.Op == "allSettled" {
				e.E = NameSet{}
			}
			eff.join(e)
		}
		eff.Effect = true
	case *ForConcurrent:
		body := in.stmts(s.Body)
		body.Cost *= len(s.Elems)
		eff.join(body)
		eff.Effect = true
	case *Retry:
		body := in.stmts(s.Body)
		body.Cost *= s.Times + 1
		eff.join(body)
		eff.Effect = true
	case *Mask:
		eff.join(in.stmts(s.Body))
		eff.join(in.stmts(s.Restore))
		eff.join(in.stmts(s.After))
		eff.Effect = true
	case *MaskFork:
		eff.join(in.stmts(s.Masked))
		eff.join(in.stmts(s.After))
		eff.Effect = true
	case *ForOfProducer:
		for _, a := range s.Args {
			eff.join(in.expr(a))
		}
		eff.join(in.call(s.Prod))
		body := in.stmts(s.Body)
		body.Cost *= 4
		eff.join(body)
		eff.Effect = true
	case *Yield:
		eff.join(in.expr(s.Value))
		eff.Effect = true
	case *MakeDeferred, *Signal, *AwaitReady, *Never, *Interrupt:
		eff.Effect = true
	case *Interruptible:
		eff.join(in.stmts(s.Body))
		eff.Effect = true
	case *UsingDecl:
		eff.join(in.expr(s.Res.Arg))
		eff.join(in.call(s.Res.Acq))
		eff.join(in.call(s.Res.Rel))
		eff.Effect = true
	case *JoinAll:
		// D225: join fails with any joined fiber's failure; a fork adds
		// only its program's R (Ch 7).
		for _, f := range s.Elems {
			prog := in.fork(f)
			eff.R.union(prog.R)
			eff.E.union(prog.E)
			eff.Cost += prog.Cost
		}
		for _, f := range s.Fibers {
			eff.E.union(in.fibers[f].E)
		}
		eff.Effect = true
	case *Lifetime:
		var prog effects
		if s.Call != nil {
			prog = in.expr(s.Call)
		} else {
			prog = in.stmts(s.Hold)
		}
		eff.R.union(prog.R)
		eff.Cost += prog.Cost
		if s.Call != nil {
			// The fiber is joined, so its failures reach the caller.
			eff.E.union(prog.E)
		}
		eff.join(in.stmts(s.Between))
		if s.Result != nil {
			eff.join(in.expr(s.Result))
		}
		eff.Effect = true
	case *ExitIs:
		// exit holds every reason, so the program's E stays inside it,
		// unless Effect.failCause rethrows the cause (D406).
		var prog effects
		if s.Call != nil {
			prog = in.expr(s.Call)
		} else {
			prog = in.stmts(s.Body)
		}
		eff.R.union(prog.R)
		eff.Cost += prog.Cost
		if s.FailCause {
			eff.E.union(prog.E)
		}
		eff.join(in.stmts(s.Then))
		eff.Effect = true
	case *DataIs:
		eff.join(in.stmts(s.Then))
	}
	return eff
}

// fork is the effects of a fork's program, recorded for a later join.
func (in *inferer) fork(f *Fork) effects {
	var prog effects
	if f.Call != nil {
		prog = in.expr(f.Call)
	} else {
		prog = in.stmts(f.Block)
	}
	in.fibers[f.Name] = prog
	return prog
}

func (in *inferer) cond(c *Cond) effects {
	eff := in.expr(c.L)
	eff.join(in.expr(c.R))
	return eff
}

// call is what running a function adds to its caller: its contract, or,
// for the function being inferred, the channels found so far.
func (in *inferer) call(f *Func) effects {
	eff := newEffects()
	if f == in.self {
		// A plain recursion stays plain under its plain annotation (D72).
		eff.Effect = f.Annot != "plain"
		return eff
	}
	if f.E != nil {
		eff.E.union(f.E)
		eff.R.union(f.R)
	}
	eff.Effect = !f.Plain
	eff.Cost = f.Cost
	return eff
}

func (in *inferer) expr(x Expr) effects {
	eff := newEffects()
	switch x := x.(type) {
	case nil, *Num, *Ref, *Counter, *Topic, *TagLen, *ErrField, *DataRef, *TagOf, *TraceLen, *DataField, *Reasons:
	case *YieldNow:
		eff.Effect = true
	case *Paren:
		eff.join(in.expr(x.X))
	case *ExitTag:
		prog := in.expr(x.Call)
		eff.R.union(prog.R)
		eff.Cost += prog.Cost
		eff.Effect = true
	case *Bin:
		eff.join(in.expr(x.L))
		eff.join(in.expr(x.R))
	case *Ternary:
		eff.join(in.cond(x.C))
		eff.join(in.expr(x.T))
		eff.join(in.expr(x.F))
	case *Call:
		for _, a := range x.Args {
			eff.join(in.expr(a))
		}
		eff.join(in.call(x.Fn))
		eff.Cost++
	case *SvcCall:
		for _, a := range x.Args {
			eff.join(in.expr(a))
		}
		for _, e := range x.M.E {
			eff.E.add(e.Name)
		}
		eff.R.add(x.M.Svc.Name)
		eff.Effect = true
		eff.Cost++
	case *CtlCall:
		for _, a := range x.Args {
			eff.join(in.expr(a))
		}
		eff.R.add(x.Ctl.Name)
		eff.Effect = true
		eff.Cost++
	case *CatchExpr:
		left := in.expr(x.X)
		var handler effects
		if x.Value {
			handler = in.expr(x.Handler)
		} else {
			saved, had := in.vars[x.Var]
			in.vars[x.Var] = in.errorsNamed(left.E)
			handler = in.expr(x.Handler)
			if had {
				in.vars[x.Var] = saved
			} else {
				delete(in.vars, x.Var)
			}
		}
		eff.R.union(left.R)
		eff.Effect = left.Effect
		eff.Cost = left.Cost
		eff.join(handler)
	case *Match:
		var remaining []*ErrorDecl
		var subject string
		switch x.Kind {
		case matchExit:
			prog := in.expr(x.Subject)
			eff.R.union(prog.R)
			eff.Cost += prog.Cost
			eff.Effect = true
			for _, a := range x.Arms {
				if a.FailCause {
					// D406: Effect.failCause(cause) fails with E of the
					// exit's program.
					eff.E.union(prog.E)
				}
			}
		case matchError:
			subject = x.Subject.(*Ref).Name
			remaining = in.vars[subject]
		default:
			eff.join(in.expr(x.Subject))
		}
		for _, a := range x.Arms {
			if a.Guard != nil {
				eff.join(in.cond(a.Guard))
			}
			if a.Throw != nil {
				eff.join(in.expr(a.Throw))
				eff.E.add(a.Throw.Err.Name)
				eff.Effect = true
			} else {
				eff.join(in.expr(a.Body))
			}
			if a.Class != nil {
				remaining = without(remaining, a.Class)
			}
		}
		if x.DefaultThrow {
			eff.E.union(classNames(remaining))
			eff.Effect = true
		}
		eff.join(in.expr(x.Default))
	case *Do:
		eff.join(in.stmts(x.Body))
		eff.join(in.expr(x.Value))
	case *Pipe:
		eff.join(in.expr(x.Head))
		for _, s := range x.Stages {
			eff.join(in.expr(s))
		}
	case *ThrowExpr:
		eff.join(in.expr(x.Left))
		eff.join(in.expr(x.Err))
		eff.E.add(x.Err.Err.Name)
		eff.Effect = true
	case *Maybe:
		eff.join(in.cond(x.C))
		eff.join(in.expr(x.V))
	case *ErrNew:
		for _, f := range x.Fields {
			eff.join(in.expr(f))
		}
	case *Sync:
		for _, i := range x.Inputs {
			eff.join(in.expr(i))
		}
		eff.Effect = true
	case *TryHatch:
		eff.join(in.expr(x.Input))
		eff.E.add(x.Err.Err.Name)
		eff.Effect = true
	case *OptionNew:
		eff.join(in.cond(x.C))
		eff.join(in.expr(x.V))
	case *DataNew:
		for _, f := range x.Fields {
			eff.join(in.expr(f))
		}
	case *Join:
		fiber := in.fibers[x.Fiber]
		eff.E.union(fiber.E)
		eff.Effect = true
	}
	return eff
}

// SuccessType is the A channel of this numeric model (Chapters 2, 8 and 14).
// Producers yield numbers. A written A constrains return inference; otherwise
// TypeScript widens a numeric return to number and infers void without one.
func SuccessType(f *Func) string {
	if f.Producer() || f.Annot != "" {
		return returnType(f)
	}
	numeric := false
	var visit func([]Stmt)
	visit = func(body []Stmt) {
		for _, stmt := range body {
			if r, ok := stmt.(*Return); ok && r.Value != nil {
				numeric = true
			}
			if h, ok := stmt.(*Handle); ok && h.Abort != nil {
				numeric = true
			}
			// These bodies return to their own program, not the owning function.
			switch s := stmt.(type) {
			case *Fork, *Retry, *ForConcurrent, *MaskFork, *Lifetime, *JoinAll:
				continue
			case *ExitIs:
				visit(s.Then)
				continue
			}
			forEachBlock(stmt, visit)
		}
	}
	visit(f.Body)
	if numeric {
		return "number"
	}
	return "void"
}
