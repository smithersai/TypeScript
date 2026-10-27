package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// Tracing (design D34). With compilerOptions.vibelang.tracing set to
// "exported", each exported function compiles with an Effect.fn span named
// after it; with "all", so does every named function that compiles to
// frames, and a method's Effect runs inside an Effect.withSpan span:
//
//	export const greet = Effect.fn("greet")(function* greet(name) { … })
//
// A lambda without a name, such as a callback, gets no span.

// tracingPlan records the functions that compile with spans, and the spans'
// names.
type tracingPlan struct {
	spans map[*ast.Node]string // function -> the name of its span
}

func newTracingPlan() tracingPlan {
	return tracingPlan{spans: map[*ast.Node]string{}}
}

// planSpans records a span for each function in p.effects, and each lowered
// method, that the tracing mode of the project that owns file selects (D34,
// D297).
func (p *plan) planSpans(c *checker.Checker, file *ast.SourceFile) {
	mode := ""
	if options := optionsFor(c, file); options != nil && options.VibeLang != nil {
		mode = options.VibeLang.Tracing
	}
	if mode != "exported" && mode != "all" {
		return
	}
	for fn := range p.effects {
		name := spanName(fn)
		if name == "" || mode == "exported" && (fn.Kind == ast.KindMethodDeclaration || !isExportedFunction(c, file, fn)) {
			continue
		}
		p.spans[fn] = name
	}
}

// spanName returns the name of the span for fn: its source name, and for a
// class method, the class's name, a dot, and the method's name.
func spanName(fn *ast.Node) string {
	name := sourceName(fn)
	if name != "" && fn.Kind == ast.KindMethodDeclaration && ast.IsClassLike(fn.Parent) {
		if class := declarationName(fn.Parent); class != "" {
			return class + "." + name
		}
	}
	return name
}

// isExportedFunction reports whether fn is a function declaration, or a
// function a top-level const initializes, that file exports, by an export
// modifier or an export declaration.
func isExportedFunction(c *checker.Checker, file *ast.SourceFile, fn *ast.Node) bool {
	declaration := fn
	if fn.Kind != ast.KindFunctionDeclaration {
		declaration = fn.Parent
		if declaration == nil || declaration.Kind != ast.KindVariableDeclaration || declaration.Initializer() != fn {
			return false
		}
	}
	symbol := c.GetSymbolOfDeclaration(declaration)
	module := file.AsNode().Symbol()
	if symbol == nil || module == nil {
		return false
	}
	for _, export := range c.GetExportsOfModule(module) {
		target := export
		if target.Flags()&ast.SymbolFlagsAlias != 0 {
			target = c.GetAliasedSymbol(target)
		}
		if c.GetMergedSymbol(target) == c.GetMergedSymbol(symbol) {
			return true
		}
	}
	return false
}

// wrapFunction returns `Effect.fnUntraced(generator)` in place of node, or
// `Effect.fn("name")(generator)` when node has a span.
func (tx *lowering) wrapFunction(node *ast.Node, generator *ast.Node, pipeables ...*ast.Node) *ast.Node {
	name, traced := tx.plan.spans[node]
	if !traced {
		return tx.wrapGenerator("fnUntraced", node, generator)
	}
	f := tx.Factory()
	fn := f.NewCallExpression(
		f.NewPropertyAccessExpression(tx.effectName(), nil /*questionDotToken*/, f.NewIdentifier("fn"), ast.NodeFlagsNone),
		nil, /*questionDotToken*/
		nil, /*typeArguments*/
		f.NewNodeList([]*ast.Node{f.NewStringLiteral(name, ast.TokenFlagsNone)}),
		ast.NodeFlagsNone,
	)
	lowered := f.NewCallExpression(fn, nil /*questionDotToken*/, nil /*typeArguments*/, f.NewNodeList(append([]*ast.Node{generator}, pipeables...)), ast.NodeFlagsNone)
	tx.EmitContext().SetOriginal(lowered, node)
	lowered.Loc = node.Loc
	return lowered
}

// traceMethod returns `Effect.withSpan(effect, "Class.method")` when node, a
// lowered method, has a span, and effect otherwise.
func (tx *lowering) traceMethod(node *ast.Node, effect *ast.Node) *ast.Node {
	name, traced := tx.plan.spans[node]
	if !traced {
		return effect
	}
	f := tx.Factory()
	return f.NewCallExpression(
		f.NewPropertyAccessExpression(tx.effectName(), nil /*questionDotToken*/, f.NewIdentifier("withSpan"), ast.NodeFlagsNone),
		nil, /*questionDotToken*/
		nil, /*typeArguments*/
		f.NewNodeList([]*ast.Node{effect, f.NewStringLiteral(name, ast.TokenFlagsNone)}),
		ast.NodeFlagsNone,
	)
}

// forwardedTrace captures a declaration's caller before invoking Effect.fn.
// Effect.fn captures only two JS frames; the forwarding declaration consumes
// the caller's slot. A pipeable runs inside fn's logical frame, so replace
// only its stack supplier and keep fn's span, definition frame and parent.
// The declaration still owns its identity, name, length, this and arguments;
// its generator still evaluates parameters lazily, once per execution.
func (tx *lowering) forwardedTrace(node *ast.Node) (statements, pipeables []*ast.Node) {
	if _, traced := tx.plan.spans[node]; !traced {
		return nil, nil
	}
	f := tx.Factory()
	property := func(value *ast.Node, name string) *ast.Node {
		return f.NewPropertyAccessExpression(value, nil, f.NewIdentifier(name), ast.NodeFlagsNone)
	}
	call := func(value *ast.Node, args ...*ast.Node) *ast.Node {
		return f.NewCallExpression(value, nil, nil, f.NewNodeList(args), ast.NodeFlagsNone)
	}
	binding := func(name, value *ast.Node, flags ast.NodeFlags) *ast.Node {
		return tx.generated(f.NewVariableStatement(nil, f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{
			f.NewVariableDeclaration(name, nil, nil, value),
		}), flags)))
	}
	assign := func(left, right *ast.Node) *ast.Node {
		return f.NewExpressionStatement(f.NewBinaryExpression(nil, left, nil, f.NewToken(ast.KindEqualsToken), right))
	}
	// Match Effect's opt-out and bounded stack capture. Reading the stack is
	// lazy so Node applies source maps when a failure renders the frame.
	errorClass := property(f.NewIdentifier("globalThis"), "Error")
	limit := f.NewUniqueName("traceLimit")
	trace := f.NewUniqueName("trace")
	stackLimit := property(errorClass, "stackTraceLimit")
	// Reflect.set also works when Error is frozen: like Effect's guarded
	// setter, it leaves a non-writable limit alone instead of throwing.
	setLimit := func(value *ast.Node) *ast.Node {
		return f.NewExpressionStatement(call(property(property(f.NewIdentifier("globalThis"), "Reflect"), "set"), errorClass, f.NewStringLiteral("stackTraceLimit", ast.TokenFlagsNone), value))
	}
	statements = append(statements, binding(limit, stackLimit, ast.NodeFlagsConst), binding(trace, nil, ast.NodeFlagsLet))
	statements = append(statements, tx.generated(f.NewIfStatement(
		f.NewBinaryExpression(nil, limit, nil, f.NewToken(ast.KindExclamationEqualsEqualsToken), f.NewNumericLiteral("0", ast.TokenFlagsNone)),
		f.NewBlock(f.NewNodeList([]*ast.Node{
			setLimit(f.NewNumericLiteral("2", ast.TokenFlagsNone)),
			assign(trace, f.NewNewExpression(errorClass, nil, f.NewNodeList(nil))),
			setLimit(limit),
		}), true), nil)))

	// trace?.stack?.split("\n")[2]?.trim() is Effect's two-frame cleaner,
	// with the capture in the declaration itself rather than its callee.
	stack := f.NewPropertyAccessExpression(trace, f.NewToken(ast.KindQuestionDotToken), f.NewIdentifier("stack"), ast.NodeFlagsOptionalChain)
	split := f.NewPropertyAccessExpression(stack, f.NewToken(ast.KindQuestionDotToken), f.NewIdentifier("split"), ast.NodeFlagsOptionalChain)
	lines := f.NewCallExpression(split, nil, nil, f.NewNodeList([]*ast.Node{f.NewStringLiteral("\n", ast.TokenFlagsNone)}), ast.NodeFlagsOptionalChain)
	line := f.NewElementAccessExpression(lines, nil, f.NewNumericLiteral("2", ast.TokenFlagsNone), ast.NodeFlagsOptionalChain)
	trim := f.NewPropertyAccessExpression(line, f.NewToken(ast.KindQuestionDotToken), f.NewIdentifier("trim"), ast.NodeFlagsOptionalChain)
	clean := f.NewCallExpression(trim, nil, nil, f.NewNodeList(nil), ast.NodeFlagsOptionalChain)
	frame := f.NewUniqueName("frame")
	replace := tx.generated(tx.arrow([]*ast.Node{f.NewParameterDeclaration(nil, nil, frame, nil, nil, nil)}, f.NewObjectLiteralExpression(f.NewNodeList([]*ast.Node{
		f.NewSpreadAssignment(frame),
		f.NewPropertyAssignment(nil, f.NewIdentifier("stack"), nil, nil, tx.generated(tx.arrow(nil, clean))),
	}), false)))
	effect := f.NewUniqueName("effect")
	update := call(property(tx.effectName(), "updateService"), effect, property(tx.moduleNamespace("effect/References"), "CurrentStackFrame"), replace)
	return statements, []*ast.Node{tx.generated(tx.arrow([]*ast.Node{f.NewParameterDeclaration(nil, nil, effect, nil, nil, nil)}, update))}
}
