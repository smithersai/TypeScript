## Part V. Decisions

### 29. Decisions

```text
settled before this document      1-7        the original design decisions
decisions                         D1-D391    every decision since; a number without a row is unassigned
rules of the runtime and compiler P1-P22     adopted by D29, revised by verified counterexamples
```

This chapter indexes the decisions. The rules they adopt are stated in the chapters, which are normative (D360); `docs/design/DECISIONS.md` gives each decision's reason, evidence, and history. A decision's status is blank while it is in force as written; **Amended by** names the later decisions that changed its rule, and the chapters state the rule as amended; **Superseded by** marks a decision that is history only. Unassigned numbers: D84-D89, D114-D119, D136-D145, D157-D165, D181-D185, D189-D195, D198-D205, D224, D233-D235, D300-D302, D314-D319, D337-D339, and D357-D359.

#### Settled before this document

From the earlier conversation; not reopened.

1. Every function participates in one computation model: no `effect function` keyword, no `effect(...)` wrapper. Ordinary calls compose computations and expose successful results with no marker at each call. Programs must be values you can construct, store, pass, retry, and compose concurrently (D7 spells it).
2. An explicit contract is an `Effect<A, E, R>` return annotation. It describes the whole computation; the return expression is checked against A. Most code infers. Success, errors, and requirements each support inference or explicit declaration. Partial annotations must distinguish inference from `never`. Function types, callbacks, service methods, and exported declarations use the same contract model.
3. `throw` adds to the owning computation's inferred E; an explicit E constrains what escapes. `Effect<A, never, R>` may handle expected failures internally but rejects escaping ones. Expected failures, defects, and interruption stay distinct.
4. Optimization preserves computation semantics. E = never and R = never prove neither purity nor synchronous completion. Constructing a cold program never runs its work.
5. Dependency injection is core, designed with the continuation semantics: identity, contracts, inferred and declared requirements, acquisition, composition, missing, ambiguous, and cyclic providers, acquisition failures, residual requirements, scoped sharing and release, test overrides, Context across suspension and children, and interoperability with Effect Context keys and Layers. No second DI container.
6. New syntax must earn its place. Ordinary function syntax and the `Effect<A, E, R>` annotation reuse TypeScript syntax. (Refined since: a form earns its place by saving tokens, and new syntax comes from TypeScript or a TC39 proposal; D126-D156 and D166-D239 apply the refinement.)
7. Broad npm interoperability is not an MVP constraint. Interop with TypeScript code that already uses Effect is.

D57 supplies decision 2's partial-annotation spelling: explicit `infer Name` slots.

#### Decisions

| # | Decision | Reason and evidence | Status | Chapters |
| --- | --- | --- | --- | --- |
| D1 | Services are abstract classes with only abstract instance members; nominal; derived, unique keys; no `extends`, `new`, `instanceof`, or generics; emitted per D45 | Uses no valid TypeScript meaning (TS2339, TS2348); structurally equal classes would alias (probe); rare in real code | Superseded by D128, D223 (keywords), D45 then D361 (emit) | 4 |
| D2 | Control operations are abstract classes extending the global `Control` | One declaration form for services and operations; no keyword | Superseded by D128, D223 | 9 |
| D3 | Errors use the global `TaggedError` | Effect's `Data.TaggedError`; `Schema.TaggedError` for serialized errors |  | 3 |
| D4 | The prelude: `Effect`, `Schema`, `Layer`, `TaggedError`, `Control`, and the built-ins; imports shadow it | What 77-81%, 39-44%, and 34-44% of Effect files import |  | 1 |
| D5 | Calls to non-Effect code need a declared trust level | Foreign code may throw; platform APIs are replaced; clock reads go through services | Amended by D148, D249, D329 | 10 |
| D6 | The standard library is Effect's | Effect ships the modules and the platform implementations |  | 11 |
| D7 | Program values are functions with no arguments | No new syntax; `() =>` already means "not yet" | Amended by D320, D322, D381 | 5, 13 |
| D8 | No `\|>` in v0; the `pipe(program, …stages)` built-in stays. | Calls run before a pipe sees them; Stage 2 since 2021; 1.1% and 2.6% of pipes keep two stages | Superseded by D154 | 5 |
| D9 | A function value where a plain function is expected passes its plain-JavaScript form, or EK4301 | Plain JavaScript callbacks need a direct calling convention | Amended by D66, D112, D113, D324 | 13, 16 |
| D10 | Plain JavaScript when a function performs no Effect operation and E is never; source order kept; a function on a cycle of plain calls keeps its plain type, runs shallow recursion as fast JavaScript, then continues on heap frames without a recursion-depth limit | Preserves source order and fast JavaScript recursion for plain helpers; plain `countdown` overflowed at 20,000 calls (case `recursion-stack-safe`) | Amended by D65, D67, D326, D333, D341, D372 | 15 |
| D11 | Higher-order functions compile to frames in v0 | Higher-order calls need continuation frames until specialization |  | 15, 16 |
| D12 | A callback type without a contract accepts any contract; unchanged by D57 | Settled decision 2 forbids reading it as `never` | Amended by D68, D331 | 16 |
| D13 | `catch` handles a cause only when it holds no defect; a failure beside a defect is a defect (D305), and one beside an interruption is caught (D306) | K14a-K14d | Amended by D305, D306, D349 | 3, 17, 26 |
| D14 | Only `using` acquisitions belong to the block | An acquisition without using belongs to its caller |  | 6, 23, 26 |
| D15 | A failure during cleanup is never dropped | Cleanup failures remain visible under interruption; K12a-K12e | Amended by D256, D340, D355 | 17, 21 |
| D16 | v0 exposes `handle`, `resume`, `resumeWith`, `abandon`; `transfer` stays in the standard library | K13 bounds a transfer by its fiber, and G3 remains |  | 9, 21 |
| D17 | `resumeWith` runs code whose R is `never` | Injected requirements resolve in the capture-time Context |  | 9, 20 |
| D18 | A clause whose last step is `resume` compiles to the tail-resume shape | Returning a tail-resume request removes the clause frame; K11a-K11d |  | 20, 26 |
| D19 | `fork` is block-owned | Children exit before the block's resources are released |  | 7, 26 |
| D20 | A TypeScript function whose R holds a control operation is EK4202 in v0 | Foreign functions may fork where the handler cannot reach |  | 9, 16 |
| D21 | Each `Effect.provide` builds its layers once; provide at `main`; `ManagedRuntime` for several entry points | Avoids rebuilding a layer for every request; conformance test D05 |  | 4 |
| D22 | Effect's own packages are trusted, with the functions and values they return | D6; `Option` and `Result` are data in Effect 4 |  | 10 |
| D23 | A trusted contract is the `@vibelang trusted` JSDoc tag, with `@throws` | TypeScript syntax only; the compiler's metadata channel | Amended by D249, D389 | 10, 27 |
| D24 | A call runs only `Effect` itself; subtypes are data until called; `new` never runs | `Config`, `Exit`, keys, and errors extend `Effect` | Amended by D90, D109, D320, D321, D323 | 13 |
| D25 | `using` adds no masking policy | K15a-K15c | Amended by D342 | 6, 21 |
| D26 | Producers: `for...of` by type; a producer is a `Stream` to TypeScript; the adapter runs it on its own fiber behind a zero-capacity handoff | Stream operators pull on other fibers; continuations are fiber-affine; a one-element buffer runs ahead | Amended by D82, D371 | 8, 26 |
| D27 | `wire` is an intrinsic with a bounded contract (EK3201-EK3204) | Layer types carry outputs and inputs | Amended by D326, D363 | 4 |
| D28 | A `catch` over several expected failures receives the first | K14a |  | 3, 17 |
| D29 | P1-P22 are the spec's rules, as revised below | Verified runtime counterexamples refine the original rules |  | 29 |
| D30 | Installation: `vibelang` (`vibelang`) and `vibelang-runtime`; `effect` 4.0.6 exactly | Mirrors `typescript@7` packaging |  | 28 |
| D31 | Builds: `vibelang --watch`; `vibelang-vite` for Vite | One checker for CLI, editor, and bundler | Amended by D105, D106, D107, D365 | 28 |
| D32 | The editor: `vibelang --lsp --stdio`; the `vibelang.vibelang` extension | The fork's binary already serves LSP |  | 28 |
| D33 | v0 editor features: hover, completions, quick fixes, four refactors | The diagnostics with mechanical fixes |  | 28 |
| D34 | Diagnostics: errors, except the policies EK2004 (a warning) and EK4403; `compilerOptions.vibelang` | Soundness errors cannot be lowered | Amended by D241, D275, D297 | 28 |
| D35 | One owner per diagnostic: `vibelang` for types and language, Oxlint for lint | tsgolint embeds TypeScript's checker | Amended by D277 | 28 |
| D36 | Debugging through composed source maps; spans for logical stacks | The frame invariant keeps callers off the JavaScript stack |  | 28 |
| D37 | Effect `catch` lets defects pass through; an Effect try with E = `never` is warning EK2004 (amended by D260 and D282) | Coverage audit X2 | Amended by D260, D282 | 3, 10 |
| D38 | Runners only where no fiber runs the code; EK1005 elsewhere | Coverage audit X4 |  | 13 |
| D39 | A function-or-Effect parameter: a function if plain, a program if it can pause | Coverage audit X9 | Superseded by D324 | 13 |
| D40 | Service statics: `layer`, `make`; `static readonly default` makes a `Context.Reference` | Coverage audit X12 | Amended by D362 | 4 |
| D41 | `S.member(…)` always adds `S` to R; service members win over the key's members; EK3006 for a static that shares a member's name | Coverage audit X13; prototype findings 3, 4 | Amended by D90, D388 | 4, 13 |
| D42 | Workflow bodies are ordinary programs: interrupted on durable suspension, rerun on replay | Coverage audit X17; `workflow/Workflow.ts:695-780, 1031-1036` |  | 23 |
| D43 | `Effect.callback` is an explicit boundary; its `resume` takes an Effect, and `.vibe` passes an `Exit` | Coverage audit X11; `Effect.ts` |  | 6, 10 |
| D44 | "The expected type" is the declared, uninstantiated parameter type of the resolved overload | the contextual type is inferred from the lambda itself | Amended by D324 | 13 |
| D45 | A service compiles to an interface plus a `Context.Key` class, with an optional brand | Effect's class form breaks `implements` (TS2720) | Superseded by D361 | 4, 27 |
| D46 | `finally` lowers to `Effect.onExit`; `throw` to `return yield* Effect.fail(e)`; E is the type of causes made only of expected failures | Prototype findings 11, 12, 14 | Amended by D340, D355 | 14, 17, 26 |
| D47 | A block that declares `using` or calls `fork` is a Scope region | Fork-only blocks require an owning Scope |  | 23, 26 |
| D48 | `Scope` joins the prelude, as module and type | Contracts name it constantly; Effect 4's type is `Scope.Scope` |  | 1 |
| D49 | Arrays and records of programs convert where Effects are expected | Effect.all accepts collections of programs | Amended by D69, D111, D322 | 5, 13 |
| D50 | `Continuation<V, E, H>`: `resume` returns the `handle`'s result type | A resumed computation returns the handler's result | Narrowed by D97; restored by D351 | 9 |
| D51 | Plain calls at a module's top level are ordinary calls; `@throws {T}` names a class | Module initialization runs outside a program |  | 10 |
| D52 | E and R of recursion by a fixpoint inside the component, never a whole-program pass (EK2102 for A); A widens; definite assignment on the source | Prototype findings 7, 10, 13; the single-pass probe `isEven`/`isOdd` |  | 14, 26, 27 |
| D53 | Diagnostic codes follow the prototype | Prototype diagnostics | Amended by D67, D70, D71, D74 | 28 |
| D54 | Inside a plain-JavaScript function, `try`, `catch`, and `finally` are JavaScript's own statements, and its catch still receives typed failures only (D282) | D10 with D5: nothing in the function can pause | Amended by D260, D282, D333; superseded in part by D340 | 15 |
| D55 | A method implementing a plain-function member (`[Equal.symbol]`, `[Hash.symbol]`) compiles to a plain JavaScript method, or EK4301 | The member's declared type is not an Effect |  | 15 |
| D56 | Each overload candidate's declared parameter type, never the lambda's own inferred type, decides a lambda's form (plain, Effect function, program); the first candidate that accepts it wins. D10 eligibility is computed on demand | Single-pass experiment: 0 disagreements in 46 files; 6 probe lambdas with two self-consistent lowerings | Amended by D324, D380 | 13, 15, 27 |
| D57 | Partial annotations use `infer Name` per channel in a function return annotation with a body; a slot left out of `Effect<…>` is `never`, as in TypeScript (D308, D309). D12 stands | TypeScript 7 parses `infer`; explicit slots distinguish inference from `never` | Amended by D308, D309 | 2, 14, 16, 28 |
| D58 | Keep EffectScript, `esc`, `.es`, and `@effectscript`; superseded by D125 | Another compile-to-JavaScript language uses the name | Superseded by D125, D255 | 28 |
| D59 | Draft upstream issues and proposals in `docs/upstream/`; status: drafted, not filed | Upstream filing requires maintainer approval |  | 24, 25, 30 |
| D60 | One repository, with the compiler in `typescript/`; the compiler is in `typescript/` | Spec and implementations change together; the imported TypeScript tree omits 349 MB of baselines |  | 27, 28 |
| D61 | An EK diagnostic is a TypeScript diagnostic with source `EK`, on upstream's content-mapper path | One diagnostic path for CLI and LSP |  | 28 |
| D62 | The prelude is the runtime's exports | Lazy imports preserve files that use no prelude names |  | 1, 27 |
| D63 | A `.vibe` file imports `./x.vibe` or `./x.ts` by source name with no flag (no TS5097); specifiers become `.js` in JavaScript and `.d.ts` output | Source names for checking, output names for JavaScript | Amended by D365 | 10, 27, 28 |
| D64 | A failing compiler case passes when its exact set of error codes matches (TypeScript codes count, warnings do not); a runnable case compares only its `@@result` line, so programs may log | Exact codes detect regressions |  | 10, 27, 28 |
| D65 | A `.vibe` call to a plain function runs inline as `f$direct(a)` everywhere, including a module's top level | It computes a value and runs no program | Amended by D366 | 13, 15 |
| D66 | An overload candidate that asks for a plain function rejects a `.vibe` function value that can pause, as it rejects such a lambda (D56 extended to function values); a TypeScript function returning an Effect passes as data; if every candidate rejects, EK4301 reports against the first candidate's form | Named values and lambdas need the same callback safety | Amended by D324 | 13, 16 |
| D67 | A function with a plain return annotation keeps that type and compiles to one plain function; only unannotated or Effect-contract functions get the `$direct` plus `Effect.sync` pair, whose TypeScript type is `(…) => Effect<A, never, never>` (chapter 15's one calling convention) | Plain annotations support JavaScript protocols | Amended by D332 | 10, 14, 15 |
| D68 | D12 covers declarations, methods, and function expressions that are not call arguments; the added type parameters, named E and R (then E2, `tests/runtime-boundaries.test.ts`), appear in `.d.ts` output | Missing callback channels must not mean never | Amended by D321, D331 | 16, 27 |
| D69 | A program lambda lowers to `Effect.gen(function* …)`, a converted function value to `Effect.suspend(v)`, and an array or record of programs built at run time to `$programs` | Conversions must preserve cold execution |  | 5, 13, 27 |
| D70 | A `return`, `break`, or `continue` that leaves a `finally` block is a new error, EK2006 | In JavaScript such a jump discards the failure in flight; `finally` compiled to Effect cleanup cannot honor it |  | 17, 28 |
| D71 | EK2102 also covers a `catch` variable or return type typed before its cycle's E and R are known; fix: a written contract | The checker cannot revise cached recursive types |  | 14, 28 |
| D72 | EK2102 applies only to functions that run Effects; a pure recursive function keeps TypeScript's TS7023, which a plain annotation fixes (consistent with D67) | Pure recursion needs no Effect channel analysis |  | 14, 15 |
| D73 | A call to a function with a complete written contract adds the contract's E and R, not what its body does | Callers rely on the public contract | Amended by D335 | 14 |
| D74 | A method's plain annotation is checked as a function's: running an Effect under one is EK2003, and so is a throw that can escape it (D282). A method implementing a plain-function member (D55) is checked against that member instead, as EK4301. **Revised**: methods were exempt, so a method that ran an Effect under `: number` returned an unrun Effect to callers that reached it through an interface or its declaration file | A method's annotation is its type in declarations and structural types; a method implementing a plain-function member (D55) still needs a plain annotation |  | 14, 15 |
| D75 | The `tsc/cmd/tsc` binary identifies as VibeLang; no separate cmd/vibelang | One upstream entry-point seam |  | 27, 28 |
| D76 | The editor serves `.ts` only when the built-in TypeScript extension is disabled, or with Cursor's useTsgo | Disabling validation also hides VibeLang diagnostics; amends D32 |  | 28 |
| D77 | Hover shows a running call's success value and a plain helper's direct and TypeScript-facing signatures; `.ts` hover is unchanged | Explains both call semantics and the helper ABI |  | 15, 28 |
| D78 | Prelude names and service members complete in scope; local declarations shadow prelude names | Discoverability without explicit imports |  | 1, 4, 28 |
| D79 | Reuse TypeScript TextMate grammar; resolve vibelang from setting, project, then PATH; require workspace trust | Keep theme support and project compiler ownership |  | 28 |
| D80 | The runtime checks Effect's version by importing effect's package metadata with a static JSON import attribute | JSON attributes work in Node, Bun, and bundlers |  | 27, 28 |
| D81 | The runtime exports `suspend`, `handoff`, `Resumer`, and `HandoffProtocolViolation` for TypeScript callback adapters (D43) | Resource adapters need cancellation and lost-race reporting |  | 6, 21 |
| D82 | The extraction kept the prototype helpers' behavior and continuation parameter order; spec discrepancies are documented in packages/runtime/README.md, not silently fixed | Extraction must preserve compiler compatibility |  | 26, 27 |
| D83 | Setup writes absolute `file:` dependencies on the repository's packages into new projects instead of `bun link`, so a project works only while the checkout stays where it is | Nothing registers globally and nothing is published | Amended by D120 | 28 |
| D90 | The member-call rule (D41) is structural: any Context key whose service type declares the member, including `.vibe` services, TypeScript `Context.Service` classes, and Effect's `FileSystem` and `Path` | Context keys and VibeLang services share call behavior |  | 4, 13 |
| D91 | A control-operation call lowers like a service call, `yield* (yield* Approval).approve(x)`, as the prototype did (amending the original Chapter 13 lowering); `handle` provides an implementation that performs the kernel operations | Preserves the prototype implementation pending F7 |  | 9, 13 |
| D92 | A `.vibe` method becomes an Effect when its body runs or looks up an Effect, or its expected type returns one; it stays a method whose body is `return Effect.gen({ self: this }, function* () { … })` | Generators must retain the method receiver | Amended by D327, D332 | 15, 27 |
| D93 | Service keys use package, module, and name; defaults require `static readonly`; EK2101 requires an Effect type (all three channels until D308); wire emits consumers first | Stable service identity and bounded provider analysis | Amended by D361, D363 | 4, 14 |
| D94 | Effect acquisitions receive the block Scope; other initializers need Disposable, null, or undefined; Disposable results also run Symbol.dispose | Effect acquisitions and ordinary Disposables have different ownership | Superseded by D342, D343 | 6 |
| D95 | In an Effect function, `for (using x of values)` owns a Scope region per iteration and closes its source on early exit; `for (using x = v; test; step)` owns one region around the whole loop, with its head acquired once | Cleanup belongs to the iteration that owns it |  | 6, 7 |
| D96 | A `fork` belongs to the innermost block around it; `() => fork(p)`, an arrow function with an expression body, is `Effect.forkScoped` and keeps `Scope` in R | An expression body has no owning block | Superseded by D353 | 7 |
| D97 | Continuation H is the program's A, or never with onReturn; handle unions program and clause results | TypeScript fixes H before checking onReturn; mixed early returns can narrow resume too far | Amended by D351 | 9 |
| D98 | Producers return lazy Streams; direct loops use the consumer fiber, Stream operators use a separate fiber and a handoff with no buffer | Lazy interoperability, cleanup, and bounded stack without running ahead | Amended by D370, D371 | 8, 26 |
| D99 | EK4201 checks known fiber boundaries and control-requiring producer arguments; EK4202 checks foreign callees' declared control requirements | Diagnose unreachable handlers; runtime enforces fiber ownership |  | 9, 16 |
| D100 | Code no fiber runs is plain JavaScript for EK4401 too: a module's top level and the plain callbacks it passes to TypeScript functions (`describe` bodies, route handlers), the same places D38 allows runners | Framework callbacks run outside a fiber | Amended by D329 | 10, 13 |
| D101 | Only built-ins that parse outside text declare expected failures (`JSON.parse` with `SyntaxError`, `decodeURI` and `decodeURIComponent` with `URIError`) | Unlisted built-in exceptions remain defects |  | 10, 26 |
| D102 | Original platform-import restriction; import half superseded by D108; globals and allowed web standards retained | Platform work needs typed, replaceable Effect services | Amended by D108, D310 | 10, 11 |
| D103 | EK1001 covers any top-level call that would run a program, including service member calls and Effect-value calls, reported once at the outermost call | One outer call identifies attempted program execution |  | 13, 28 |
| D104 | Compiled generators are named after their function, variable, or property (an object method `{ *name() {} }.name` when the body refers to that name); `tracing: "exported"` spans exported functions, `"all"` every named lowered function plus methods through `Effect.withSpan("Class.method")`; anonymous lambdas get no span | Names and spans identify source failures | Amended by D274, D327, D328 | 19, 26, 28 |
| D105 | Vite compiles a project through one shared vibelang subprocess per source revision, with cached output; amends D31 | Whole-project checking keeps caller contracts consistent |  | 28 |
| D106 | After an edit the plugin invalidates every loaded `.vibe` module and its transitive importers | Callers compile differently when a contract changes |  | 28 |
| D107 | Sources must sit under Vite's root; the plugin overrides emit paths and source roots there | One source root makes output lookup and source maps predictable | Amended by D374 | 28 |
| D108 | (Amended by D310.) EK4402 reports platform execution, including calls and property reads; imports and passing values are allowed. Supersedes the import half of D102 | Effect adapters must accept host function values | Amended by D310 | 10, 11, 28 |
| D109 | An expected callback or program asks for the Effect form only when its type is effect's own `Effect` interface, or a type parameter constrained to it; subtypes such as `Config` are data, so `Config.orElse`'s fallback stays plain | D24 keeps structured subtypes as data |  | 13, 16 |
| D110 | The `pipe` look-ahead (D8) reads the first stage's callee signatures, or a function value's own signatures; it runs only when the first argument can be a program, and never checks the stage early | Reading signatures avoids circular inference | Superseded by D383 | 5, 13 |
| D111 | The D49 conversion covers any iterable (`Set`, a `Map`'s values) through its iterated type; an iterable never converts as a record | Matches `Effect.all` at run time |  | 5, 13 |
| D112 | A callback whose expected return mixes plain and Effect (`boolean \| Effect<…>`) is plain when D10 allows and an Effect function otherwise; the same holds wherever both forms fit | D10 selects the eligible form without Effect work | Amended by D324 | 13, 16 |
| D113 | A lambda with a contract that takes the plain form has type `(…) => A`; where only a plain function fits, inference from its annotation starts from A | Plain inference needs A rather than its Effect wrapper | Amended by D324 | 14, 16 |
| D120 | Local runtime dependencies use setup's tarball; refresh all three packages with bun update; examples omit bun.lock | Avoid a second Effect copy that prevents child interruption; amends D83 |  | 27, 28 |
| D121 | Effect trust follows re-exports and returned values, including assertions from @effect/vitest | Tests need usable assertions; direct Vitest imports and local TypeScript retain boundary checks | Amended by D332 | 10, 16 |
| D122 | Every runner checks all services it does not supply; it.effect supplies Scope and its layer services | Diagnose missing services before execution |  | 4, 28 |
| D123 | Declaration prelude imports use free aliases when names are already bound | Avoid duplicate identifiers in declaration consumers | Amended by D328, D366 | 27 |
| D124 | Setup relinks vibelang launchers pointing into another checkout or at missing files | Keep the launcher usable after workspace changes |  | 28 |
| D125 | The language is Effeck: binary `effeck`, files `.effeck`, codes `EK`, unscoped npm packages `effeck`, `effeck-runtime`, `effeck-vite` | The `@effectscript` npm scope belongs to another language | Superseded by D255 | 28 |
| D126 | `error NotFound { id: string }` declares a tagged error class with readonly fields | Fewer tokens for the most common declaration | Amended by D278, D279, D304 | 3 |
| D127 | (Superseded by D308, restored by D309.) Effect types are written `Result!Error!Dependencies`; an empty slot is never, and left-out dependencies are inferred on a function with a body | Fewer tokens than `Effect<A, E, R>` in every contract | Superseded by D308; restored by D309 | 14 |
| D128 | (Amended by D220, reverted by D223.) `service` and `control` declare abstract classes whose bodiless members are abstract; an implemented member is EK2103 | Fewer tokens than `abstract class` and `abstract` on every member | Amended by D223, D278, D281 | 4, 9 |
| D129 | (Superseded by D221.) `layer UsersLive: Users { setup; find(id) { ... } }` is `Layer.effect` (or `Layer.succeed` without setup); setup after members is EK2104 | Fewer tokens than `Layer.effect(S, () => { return { ... } })` | Superseded by D221 | 4 |
| D130 | `with` provides a layer to a block, renamed `provide` by D172 | One region keeps `return`, `break`, and `continue`; the block takes what `Effect.provide` takes | Amended by D172, D173, D362 | 4 |
| D131 | A typed catch clause names the failures it handles | Catching by tag in the clause | Superseded by D216 | 3 |
| D132 | `try { } handle Op(x) { }` clauses handle a control's operations | Bodies and clauses stay code of the enclosing function |  | 9 |
| D133 | `schema` declares a struct schema and its decoded type | One declaration, so the schema and its type cannot drift |  | 11 |
| D134 | Members are readonly unless written `mutable` | Immutable data is the common case; the docs wrote `readonly` 186 times |  | 10 |
| D135 | An exported parameterless `main` runs when the host starts its module; a top-level runner, resolved by symbol, suppresses the entry | `node dist/main.js` runs the program, and importing the module runs nothing | Amended by D312, D387 | 1, 13 |
| D146 | Every export of `effect`'s root is in scope; JavaScript's own globals win, host globals do not | Imports from `effect` were 5.9% of the docs' tokens |  | 1, 27 |
| D147 | A call is passed by name where a parameter expects a program: `fork(fetchReport())` | Thunks around single calls were 2.6% of the docs' tokens | Superseded by D320, D322 | 5, 13 |
| D148 | (Amended by D229-D232.) `sync`, `try`, and `callback` are boundary hatches whose first arguments are plain TypeScript | One visible escape hatch replaces five Effect constructors and their lambda rules | Amended by D229-D232, D328, D330 | 10, 28 |
| D149 | `try(…)` parses as a call in `.vibe`; Effect's `{ try, catch }` object is EK4404 | A try statement needs a block, so `try (` is unambiguous |  | 10, 28 |
| D150 | `runPromise`, `runFork`, `runSync`, `runCallback` are in the prelude, for TypeScript and hatch bodies | The way back in; EK1005 still applies where a fiber runs |  | 10, 13 |
| D151 | `sleep`, `log`, `retry`, `timeout`, `all`, `forEach`, `race`, and seven more Effect functions need no prefix | They were 329 of the 538 `Effect.` member uses in the docs | Amended by D328 | 1, 27 |
| D152 | A value of an Effect data type takes its module's data-first functions as methods: `stream.filter(p).take(3)` is `Stream.take(Stream.filter(stream, p), 3)`; own members win | Removes the module prefix and nesting from data-type code; the emitted calls tree-shake as Effect's do | Amended by D295, D328, D336 | 5, 13 |
| D153 | A data type's method exists only in a call; any other access is EK4501 | No function value exists to bind |  | 13, 28 |
| D154 | The Hack pipe operator in `.vibe` files: `x \|> f(%, a)`, topic `%`, left-associative, looser than every binary operator; supersedes D8 | Fewer tokens and no nesting for operator chains; any argument position | Amended by D325, D326 | 5, 27 |
| D155 | A topic follows the by-name rule: where `%` stands for a program, the left side is passed by name; elsewhere it runs once, before the body; both in one pipe is EK1008 | `fetchUser(id) \|> retry(%, policy)` must retry the call, as `retry(fetchUser(id), policy)` does | Superseded by D325 | 5, 13 |
| D156 | A pipe's body must use `%` (EK1006); `%` outside a pipe's body is EK1007; after an operand `%` is still the remainder | The proposal's early errors; `%` keeps its JavaScript meaning where it already has one |  | 5, 28 |
| D166 | `fork` is a keyword: `fork x` is `fork(x)` and `fork { ... }` forks a block | Concurrency reads as one word, with no lambda | Amended by D320, D322, D328, D391 | 7 |
| D167 | `await` waits for a Fiber, a Deferred, or an array or object of them, failing fast; superseded by D225 and D226 | Fibers need a join, and `await` was free outside hatches | Superseded by D225, D226 | 7 |
| D168 | `select` runs the first case to finish and interrupts the rest; ties go to the first written; `default` polls; `break` leaves it | First-of-several events without `raceAll` plumbing | Superseded by D197 | 7 |
| D169 | `for concurrent(n)` runs the body per item in its own fiber; `continue` ends an item; `break` and `return` are EK4605 and EK4606 | `forEach` with a concurrency option, as a loop | Amended by D326 | 7 |
| D170 | `detach(program)` and `forkIn(scope, program)` are fork's variants | Longer lifetimes without Effect's names | Amended by D322 | 7 |
| D171 | `await`'s types accept one level of arrays and objects; D228 carries the rule to `join` | Deeper recursive types exceed TypeScript's limits | Amended by D374 | 7 |
| D172 | `provide AppLive { ... }` replaces `with AppLive { ... }`; `with` still compiles, with warning EK1009 and a quick fix | VibeLang keywords reuse Effect's own names, so `provide` reads as `Effect.provide` |  | 4 |
| D173 | `provide Key = value` provides one service; comma-separated providers mix layers and services; `provide(...) { }` means the same | `Effect.provideService` without a layer, in the same block form | Amended by D362 | 4 |
| D174 | In a provider, an effect module stands for its key of the same name: `Clock` for `Clock.Clock` | `provide Clock = testClock` and `provide Scheduler = fifo` swap runtime services |  | 4, 28 |
| D175 | The analyzer reads an array of providers element by element | A layer that provides nothing would otherwise hide the others' services | Amended by D362 | 4 |
| D176 | `catch (cause: Cause)` catches every reason, as Effect.catchCause; superseded by D217 | Effect's catchCause in a typed clause's shape | Superseded by D217 | 17 |
| D177 | `throw cause` with a Cause rethrows every reason | Effect.failCause without a new keyword | Amended by D348 | 17 |
| D178 | `finally (exit)` binds the try statement's Exit | Effect.onExit in finally's shape |  | 17 |
| D179 | `exit`, `interrupt`, and `yieldNow` are bare functions | Effect's names; no bare `yield` | Amended by D322 | 7, 17 |
| D180 | `uninterruptible`, `restore`, and `interruptible` blocks | Effect's names in a block that keeps jumps |  | 17 |
| D186 | `throw` is also an expression: `x ?? throw new NotFound({ id })` | TC39 throw expressions (stage 2); fails as the throw statement does | Amended by D327, D350 | 3 |
| D187 | `do { }` is an expression whose value is its last statement's | TC39 do expressions (stage 1); a racer or an arm gets several statements | Amended by D320, D322, D327 | 13 |
| D188 | A block after a call is its program: `withSpan("load") { ... }`, `it.effect("name") { ... }`; an Effect dual takes it in its program's place | TC39 block params (stage 1); removes `() => { }` around multi-statement programs | Amended by D273, D376 | 13 |
| D196 | `await.all`, `await.allSettled`, `await.race`, `await.any` start programs by name and behave as the `Promise` methods; EK4608 | TC39 await operations and Await Dictionary; `await.x` reads as `Promise.x` | Amended by D258, D320, D322, D326, D377 | 7 |
| D197 | `await.race [...]` replaces `select`, which is EK4607 | `case` read as value comparison and "select" is not Effect's word |  | 7 |
| D206 | `match (x) { when P: v; default: d; }` is an expression; mixed `and`/`or`/`not` need parentheses (EK4705) | TC39 pattern matching (stage 1); one expression per arm, `do { }` for more |  | 3 |
| D207 | The supported pattern subset: literals, bindings, arrays, objects, matchers, extractors, `and`/`or`/`not`, guards, `is` | The proposal's core; regular expression, relational, and async forms deferred |  | 3 |
| D208 | `Option`, `Exit`, `Result`, and primitive classes compile to their own guards | Exact binding types without a runtime protocol; a shadowing local is not consulted | Amended by D328, D367 | 3 |
| D209 | A match without `default` over a finite union that misses a case is EK4701 | `Match.exhaustive` at compile time; other types throw the proposal's `TypeError` | Amended by D294, D346 | 3 |
| D210 | A binding inside `or` or `not` is EK4702 | Inline boolean lowering has nowhere to declare it | Amended by D374 | 3 |
| D211 | `is` binds only in an `if` or `while` `&&` condition, for the then branch or body (EK4703) | Nesting keeps narrowing; the proposal also scopes else and the rest of the block | Amended by D374 | 3 |
| D212 | Regular expression and relational patterns and non-literal computed keys are EK4704 | Reported with a guard as the fix instead of misparsed | Amended by D374 | 3 |
| D213 | **Deviation.** A matcher is a custom matcher, a primitive class (`typeof`), a class (`instanceof`), a predicate, or a value (SameValue) | Built-in brand checks cannot be written in a runtime helper |  | 3 |
| D214 | A match lowers to a returning block, a labeled block, or an immediately invoked arrow function | TypeScript narrows each arm and arms run Effects in every position | Amended by D368, D374 | 3 |
| D215 | `customMatcher` is exported, and every `error` class matches by `instanceof` and extracts itself | Same-tag classes stay distinct |  | 3 |
| D216 | A catch clause no longer tests a failure's type; `catch (e)` and `match (e)` or `e is T`; typed clauses warn (EK2112) | Catching by tag was too magical; pattern matching covers it |  | 3 |
| D217 | A whole cause is recovered by matching on `exit(…)`; `catch (cause: Cause)` warns (EK2113) | One mechanism, pattern matching, for failures and exits |  | 17 |
| D218 | A match on a caught failure must be exhaustive over E or rethrow with `default: throw e` | A complete match needs no rethrow | Amended by D346, D349 | 3 |
| D219 | EK2112 and EK2113 quick fixes rewrite retired clauses when the result is exact | Migration without guessing at types |  | 28 |
| D220 | (Superseded by D223.) `service class Users { ... }` and `control class Approval { ... }`: the word is a modifier, as `declare` is; the spelling without `class` warned (EK2120) | Reads as a TypeScript class and keeps Effect's word | Superseded by D223 | 4, 9 |
| D221 | A layer is Effect's own call, `Layer.effect(Users) { setup; return { ... } }` through block params, or `Layer.succeed(Users, { ... })`; `layer X: Y { }` warns (EK2121) | Layers use Effect's own calls through block params |  | 4 |
| D222 | A layer block's returned members are typed by the service; a mismatch is TS2345 at the call, a member's failures and call-time requirements must fit its contract (EK2001, EK3101), and the setup's failures, requirements, and `using` flow into the layer | Contextual typing through `Layer.effect` | Amended by D344 | 4 |
| D223 | `service Users { ... }` and `control Approval { ... }` are the spelling again; `service class` and `control class` warn (EK2120), and the quick fix removes `class` | The class keyword is redundant in a service declaration |  | 4, 9 |
| D225 | `join` is a keyword: `join f`, `join [a, b]`, `join { a, b }` join fibers (Fiber.join), failing fast; `join(` stays a call; EK4611, EK4612 | `await` on fibers confused readers about promises; Effect's own word is join | Amended by D326, D328, D391 | 7 |
| D226 | A plain `await` in VibeLang code is an error: EK4609 (fix: `join`), EK4610 (fix: `d.await()`), EK4601-EK4604; the await operations stay | In JavaScript `await` means a promise; keep that meaning |  | 7 |
| D227 | A Deferred waits with `d.await()` | Method syntax (D152) already names Deferred.await |  | 7 |
| D228 | `join`'s types reach one level of arrays and objects, as D171's did | Deeper recursive types exceed TypeScript's limits | Amended by D326, D374 | 7 |
| D229 | A hatch's TypeScript is self-contained: it reads no binding of the `.vibe` file except error declarations (EK4405, with a quick fix) | Self-contained hatch code makes native inputs explicit | Amended by D327 | 10, 28 |
| D230 | Inputs, the arguments after a hatch's function, fill its first parameters, before the signal or `resume`; `Resume<A, E>` annotates `resume` | `bind` lowers it, and parameters line up with the arguments as written | Amended by D330 | 10 |
| D231 | `try`'s error mapper stays the second argument, and inputs follow it | D148's `try(f, mapper)` keeps its meaning | Amended by D326, D330 | 10 |
| D232 | Only a hatch's first argument is TypeScript; inputs and the mapper are VibeLang; the function decides sync or async | Inputs run before the hatch, as VibeLang calls do | Amended by D326, D330 | 10 |
| D236 | `catch` is also an expression: `x catch fallback` is Effect.orElseSucceed and `x catch (e) => …` is Effect.catch; the left side runs inside the catch, and defects and interrupts pass through | Zig's inline catch; one expression replaces a try statement whose blocks only return | Amended by D293, D305, D306, D320, D322 | 3 |
| D237 | `catch` binds looser than `??` and `\|\|` and tighter than `? :`, assignment, and `\|>`, left-associative; a handler's body extends as an arrow function's does | `a() catch b() catch c` chains |  | 3 |
| D238 | A catch expression's value is `A \| B` and its E is what the fallback or handler lets escape; a handler's exhaustive `match` removes the failures; a left side that cannot fail is EK2004 | The statement's checks, applied to the expression | Amended by D293 | 3 |
| D239 | A catch expression in a hatch body is EK2114 | A hatch body is plain TypeScript |  | 28 |
| D240 | Every rule and feature of `@effect/language-service` 0.87.5 is answered: ruled out by syntax, covered by an EK code, Effect 3 only, or implemented as EK4801-EK4825, a quick fix, a refactor, a hover, or a completion | Prefer language syntax over lint where syntax expresses the rule |  | 28 |
| D241 | EK4801-EK4825 are lint: defaults of error, warning, or off; all but EK4813 adjustable in `compilerOptions.vibelang` and by `@vibelang-diagnostics` comments | They mark style and likely bugs, not code without meaning |  | 28 |
| D242 | EK4801, EK4819, and EK4820 also report in `.ts` files outside `node_modules` | VibeLang replaces the server that would run `@effect/tsgo` | Superseded by D266 | 10, 28 |
| D243 | EK4813 replaces TS2339 for an Effect 3 name of the Effect module and writes the Effect 4 name; `.ts` files get the quick fix on TS2339 | A type error with a known repair |  | 28 |
| D244 | VibeLang warns where Effect's defaults are off: `extendsNativeError`, `newPromise`, `unsafeEffectTypeAssertion` | Failures are `error` declarations, promises cannot be awaited, contracts check types |  | 28 |
| D245 | Refactors are `refactor.rewrite` code actions: write or remove a contract, interface to `schema`, async to a VibeLang function (with an `error` per `await`), calls to a pipe and back, and the two pipe styles | Effect's 15 refactors, for one function form |  | 28 |
| D246 | A layer's hover lists what it provides, needs, and fails with; `wire`'s hover its build order; `Duration.Input` strings, a brand's name, and `@vibelang-diagnostics` codes complete | Effect's hovers and completions that still apply |  | 28 |
| D247 | Platform packages are unscoped `vibelang-<os>-<cpu>` | Publishing without an npm organization | Withdrawn | 28 |
| D248 | The text projector keeps D24's reading or asks for an annotation (EK9100) | A renderer never changes a program without a diagnostic | Amended by D251, D366 | 27 |
| D249 | A trusted contract can be a value, `trusted(impl, [Errors])` | A projector that reads one file cannot see another file's JSDoc | Amended by D389 | 10 |
| D250 | The projector treats an `Exit` as data | An `Exit` and `Effect.succeed` share a TypeId at run time | Withdrawn by D251 | 27 |
| D251 | At run time an `Exit` runs; the checking rendering rejects running a D24 data type | Only the static type tells an `Exit` from a program |  | 27 |
| D252 | The projector dispatches an unproven data-method receiver at run time | One file cannot always prove a receiver's module (131 calls in the docs) | Amended by D253 | 27 |
| D253 | A data-method receiver whose module the run time cannot tell asks for an annotation | An `Exit` carries the Exit and the Effect TypeIds |  | 27 |
| D254 | The checking rendering rejects running only an `Exit` | The run time tells `Config`, keys, and errors from programs |  | 27 |
| D255 | The language is VibeLang: `vibelang`, `.vibe`, `EK` codes, unscoped packages | Renamed before the 0.0.1 launch |  | 28 |
| D256 | D15 covers the cleanup VibeLang runs; Effect's operators keep Effect's rules, so `timeout` and `race` drop a loser's cleanup failure | Effect 4 races resolve on the first exit; F11e | Amended by D355 | 7, 17 |
| D257 | Overload ranking prefers a candidate that passes a program by name | `Effect.race(Effect.fail(a), Effect.fail(b))` picked the curried form | Superseded by D320, D322 | 13 |
| D258 | `await.allSettled` captures typed failures; defects and interruption propagate | `Effect.all` with `mode: "result"` |  | 7 |
| D259 | The language server reads `null` as absent for optional client fields | Zed 0.195.3's payload |  | 28 |
| D260 | EK2004's text says defects pass through a catch; its JavaScript catch in plain contracts is superseded by D282 | Plain-contract catch behavior is superseded by typed failures in D282 | Superseded by D282; for `finally`, by D333, D340 | 3, 15 |
| D261 | A project trusts TypeScript packages by name, `trustedPackages` | Workspace packages without per-function tags |  | 10 |
| D262 | An Effect-typed top-level `const` holds its initializer as a program | A module-level program value built without running | Superseded by D320, D322, D323 | 13 |
| D263 | A plain contract keeps JavaScript's throws and calls | Synchronous validation and callback APIs | Superseded by D282 | 15 |
| D264 | Shared web-standard globals keep their names over Effect's | `new Request(…)` constructs the web's Request |  | 1, 11 |
| D265 | An Effect-typed object field holds its initializer as a program | D147 applied to record fields | Superseded by D320, D322, D323 | 13 |
| D266 | EK diagnostics belong to `.vibe` files; `.ts` files keep TypeScript's verdict | A `.ts` file keeps TypeScript's meaning exactly |  | 28 |
| D267 | A tagged template runs like a call of its tag | SQL statements built with a template | Amended by D320, D322 | 13 |
| D268 | A pure export carries its direct variant, `f[$direct]`, across files | Survives aliases, barrels, default exports, and CommonJS | Amended by D332, D366, D384 | 15, 27 |
| D269 | A function declared to return an Effect may return a program (a factory); an Effect-typed `const` holds its initializer at any scope | Two-phase APIs from TypeScript | Superseded by D320, D323 | 5, 13 |
| D270 | A union made only of Effects runs where it stands | One predicate for checking and lowering |  | 13 |
| D271 | A `function*` with a JavaScript iterator annotation is a JavaScript generator | Generators that implement JavaScript protocols | Superseded by D370 | 8 |
| D272 | A curried topic-only pipe stage lowers as a method pipe | Data-last Schema combinators infer from the pipe's context | Amended by D325 | 5 |
| D273 | A block-param call accepts postfix operations | `Layer.unwrap { … }.pipe(Layer.fresh)` |  | 13 |
| D274 | A single-result Effect body returns its Effect without a generator | Two run-loop operations fewer per call | Amended by D326, D327, D341, D372 | 15, 26 |
| D275 | VibeLang settings may sit at a tsconfig's top level | Stock tools reject `compilerOptions.vibelang` (TS5023) |  | 28 |
| D276 | dprint formats `.vibe` files through a TypeScript projection | The repository's own dprint settings apply | Amended by D372 | 28 |
| D277 | ESLint lints `.vibe` files through the compiler's ESTree | typescript-eslint's rules apply unchanged |  | 28 |
| D278 | `error`, `service`, and `control` declarations are classes with full class semantics | Error classes with constructors and members | Amended by D345 | 3, 4, 9 |
| D279 | `schema error` declares an error that serializes | Most real errors are `Schema.TaggedError` classes |  | 3 |
| D280 | `schema Name = <type>` declares a schema of any mapped type | Literal unions written beside their types |  | 11 |
| D281 | `service Name: Type` declares a service of any shape, `Context.Service<Name, Type>`; its body holds only static members (EK2103) | Smithers: 103 services with the interface beside them, 8 of shape `string` | Amended by D361 | 4 |
| D282 | `throw` always fails and `catch` receives typed failures only, outside hatches; a plain function never fails and needs nothing, so a throw that can escape it, or a constructor, an accessor or a static block, is EK2003 (supersedes D263) | A plain contract excludes expected failures | Amended by D328, D329 | 3, 15 |
| D283 | A `module` declaration escapes to TypeScript | Code that must keep JavaScript's meaning, after D282 | Amended by D364 | 11 |
| D284 | A class that an `error` declaration writes draws EK4830, a Schema error class EK4837 | TypeScript-style forms with a VibeLang form are warnings with fixes |  | 3, 28 |
| D285 | A `Context.Service` class draws EK4831 | The same |  | 4, 28 |
| D286 | A constant that holds a `Schema.Struct` draws EK4832 | The same |  | 11, 28 |
| D287 | An `Effect.Effect<A, E, R>` type draws EK4833 | The same |  | 2, 28 |
| D288 | A running `Effect.succeed` or `Effect.fail` draws EK4834 | The same |  | 2, 28 |
| D289 | Effect's catch combinators draw EK4835 | The same |  | 3, 28 |
| D290 | `Effect.withSpan`, `Effect.provide`, and `Effect.provideService` draw EK4836 | The same | Amended by D376 | 4, 28 |
| D291 | `vibelang --fix` applies every safe fix to a project | One command migrates a project | Amended by D372 | 28 |
| D292 | The VibeLang skill ships in the `vibelang` package | An agent reads the skill of the installed version |  | 28 |
| D293 | Both sides of a catch expression take its contextual type | Literal tags stay literal |  | 3 |
| D294 | An exhaustive match runs its last arm without testing it | A branch no well-typed value reaches | Amended by D326, D341, D346, D368 | 3, 26 |
| D295 | Data-first functions whose receiver has another name are methods too | 41 such functions in effect 4.0.5 | Amended by D336 | 11, 13 |
| D296 | A JavaScript generator never fails | `throw` keeps one meaning | Amended by D370 | 8 |
| D297 | A `.vibe` file compiles with its own package's settings | A package states what it trusts once |  | 28 |
| D298 | A declaration imports a VibeLang module through its `.js` output | No TypeScript resolves `./x.vibe` to `x.d.ts` | Amended by D365 | 26, 27 |
| D299 | Whole-project compiles are cached on disk, keyed by what they read | Warm loads in milliseconds |  | 28 |
| D303 | A module declaration lowers inline, with a declaration file of its own | One `.vibe` file stays one JavaScript module | Superseded in part by D364; amended by D374 | 11, 26 |
| D304 | A `_tag` field declares an error family's tag type | Subclasses carry their own tags | Amended by D345, D347 | 3 |
| D305 | VibeLang follows Effect 4.0.6's defect precedence: a failure beside a defect becomes a defect where Effect or the kernel combines causes, and no typed recovery runs on it | Effect-TS/effect#9433, #9516; F11, K16 |  | 3, 14, 17, 20, 23, 24 |
| D306 | `catch` recovers the first expected failure beside an interruption, as `Effect.catch` does; an abandonment still passes through | F11c, K14c, K14d |  | 3, 14, 17, 20, 23, 24, 26 |
| D307 | `data Name { Variant; Variant { field: Type } }` declares Effect's `Data.TaggedEnum` type and its `Data.taggedEnum` constructors; `when Name.Variant { let field }` tests the tag and binds fields; EK2122-EK2127, EK4706, EK4707 | Effect's own tagged union, without writing the type and the constructors apart | Amended by D374 | 3, 11 |
| D308 | (Superseded by D309.) A contract was written `Effect<A, E, R>`, a type argument left out was `never`, as in TypeScript, and the `!` form was retired as EK1014 (superseded D127) | Uses Effect's ordinary type argument defaults | Superseded by D309 | 2, 14, 28 |
| D309 | The `!` form is restored as an alias of `Effect<A, E, R>` and is the documented form; `Effect<…>` keeps D308's meaning; EK1014 is retired; EK4833 reports only `Effect.Effect<…>` and its fix writes the `!` form (supersedes D308, restores D127) | Fewer tokens in every contract |  | 2, 14, 28 |
| D310 | Every module of `effect`'s subpath packages is in scope without an import; a JavaScript or shared web global wins (`Event` joins D264's), then a root module, and a name two subpath packages share needs an import; Node's globals and the web's I/O globals leave `.vibe` scope, and a Node.js module is not imported as a value (EK4402, amends D108) | The owner's rulings: every namespace below Effect is global; Node.js only through injection or TypeScript |  | 1, 11, 27 |
| D311 | A module's name also names its export of the same name: `Option<A>` is `Option.Option<A>`, a member the module lacks reads the export (a service call for a key, D41), `M()` is a service's implementation; the module's exports win | The owner's ruling; a deliberate change from TypeScript | Amended by D369 | 1, 4, 27 |
| D312 | The file that exports `main` names its platform once, `import "vibelang/platform/node"` (or `bun`, `browser`), and its entry statement provides that platform's bundle, `NodeServices.layer`, to a `main` that needs its services, or the experimental bundle, which holds Effect's, when `main` needs a D313 service; a provide inside `main` wins; the import loads nothing | Effect's canonical entry without a `provide NodeServices.layer` in every program, while the platform stays named in the program; EK3205 names only what the layer does not provide | Amended by D375, D387 | 11 |
| D313 | `Experimental` holds what Effect lacks, under Effect's module names | Platform APIs Effect does not wrap yet |  | 11 |
| D320 | Calls work as a TypeScript developer expects: a call runs by its callee's declared type, and only syntax delays | Types, annotations, and overload order chose evaluation |  | 2, 5, 13 |
| D321 | A call runs when its callee's declared return type is definitely an Effect; `p()` runs a program value | Instantiated types broke parametricity; returns depended on assignability |  | 13 |
| D322 | Programs are built only by syntax; a running call where a program is expected is EK1018 | By-name passing re-evaluated arguments and reordered them | Amended by D377, D381, D391 | 5, 13 |
| D323 | Annotations never hold a program or run a return; EK2115 and EK2116 retired | An annotation changed when code ran | Amended by D390 | 5, 13, 14 |
| D324 | A function literal is always a function; its form follows its destination's declared type | Body purity chose what an API received | Amended by D380, D381 | 13, 16 |
| D325 | A pipe's topic is its left side's value; EK1008 retired | The by-name topic followed the parameter's type | Amended by D383 | 5 |
| D326 | Evaluation order and binding time follow one law, rule E | Shortcuts broke operand order one at a time |  | 13 |
| D327 | Lowering keeps JavaScript's lexical context, rule L; EK1019, EK1020 | Generated functions rebound `this`, `arguments`, and `super` |  | 13 |
| D328 | Generated names are fresh, and features are recognized by resolved symbol, rule H | Generated names captured user bindings; spellings chose meaning | Amended by D391 | 13, 26, 27 |
| D329 | EK4401 applies in every function a fiber can call | A plain annotation bypassed the trust boundary |  | 10, 15 |
| D330 | Hatches have one calling convention, decided by syntax; EK4410 | An aliased hatch behaved differently |  | 10 |
| D331 | Callback polymorphism follows the language a function type is written in | Extracting an alias changed which programs compiled |  | 16 |
| D332 | The TypeScript boundary has one table, and its trust is stated | Phases and trust were spread over chapters | Amended by D384, D389 | 10 |
| D333 | The plain-JavaScript form is an unobservable optimization | JavaScript's `finally` replaced a failure the frames kept |  | 15 |
| D334 | A block param is a program wherever it goes | Placement depended on whether the callee was a dual | Superseded by D376 | 13 |
| D335 | D309 stands; a written channel is what callers see | Two spellings were called interchangeable |  | 14 |
| D336 | Data-type methods come from a table pinned with Effect | A parameter's name is not part of a type |  | 11, 13 |
| D340 | Cleanup combines failures the same way on every path | A plain `finally` replaced the failure in flight |  | 3, 15, 17 |
| D341 | Every lowering produces the frame lowering's Exit | Optimizations changed failures |  | 15, 17, 26 |
| D342 | `using` releases exactly once, through one owner | D94 disposed twice; D25 leaked a masked acquisition |  | 6, 21 |
| D343 | `using` reads its disposal method once, `Symbol.asyncDispose` first | The disposal method was read again at release |  | 6 |
| D344 | A `using` in a layer's setup belongs to the setup's block | D222 contradicted D14, D47, and Chapter 4 |  | 4, 6 |
| D345 | An error family is sealed to its file | Exhaustiveness needs a closed set of classes |  | 3 |
| D346 | A `match` without `default` must cover its subject; an open subject needs `default` | Open families died at run time |  | 3, 11 |
| D347 | An error subclass sets its own fields after `super(…)` | A subclass lost its fields |  | 3 |
| D348 | A Cause `throw` is decided by the operand's declared type; EK2140 | `unknown` and unions had no rule |  | 3, 17 |
| D349 | A catch binding is checked as code after the try block | The binding's type was not checked as flow |  | 3 |
| D350 | A throw expression in a parameter default is EK1001 | It silently did nothing |  | 3 |
| D351 | A handler has one answer type, and EK2119 is an error | A warning let a `resume` return outside its type |  | 9, 20 |
| D352 | A function known from a declaration is TypeScript to the handler check | Declarations carry no proof of a body |  | 9, 16 |
| D353 | Every block owns its forks, an expression body included; an escaping block-owned fiber is an error, EK4838 (D386) | Lifetime depended on braces | Amended by D386 | 7, 26 |
| D354 | Interrupting several fibers signals all before waiting; fiber forms read their operands once | Sequential interruption and double reads |  | 7 |
| D355 | The E guarantee is stated with its assumptions, and D256 stands beside D15 | No chapter said what E promises |  | 14, 17 |
| D356 | A construct closes the iterators it opens on every exit | Early exits leaked iterators |  | 7, 8, 26 |
| D360 | The specification is the one normative text; the decision log records why | Contradictory amendments and an incomplete index |  | Intro, 29 |
| D361 | A service's identifier is nominal: a required brand; implementations have the shape | An optional brand let a structural type relabel a requirement |  | 4, 27 |
| D362 | A provider removes only the services it provides on every path; EK3207 for anything else | Unions, empty arrays, invalid values, and unchecked defaults compiled and died |  | 4 |
| D363 | `wire` is recognized by symbol, keeps argument order, and never lets a layer provide its own input | Aliases skipped ordering; arguments ran reordered |  | 4 |
| D364 | A `module` declaration is an ECMAScript module: live bindings, import order, case-sensitive names | An import denotes a binding, not a snapshot |  | 11, 26 |
| D365 | Source specifiers are rewritten for the loader in every import form | Dynamic imports and CommonJS paths failed to load |  | 26, 27 |
| D366 | A declaration file is a semantic ABI; renderers meet the compiler's meaning | Declarations stock TypeScript rejected; two plain-call ABIs | Amended by D384 | 27 |
| D367 | A name in a pattern means what it resolves to | Renaming a local changed a match |  | 3, 11, 26 |
| D368 | A pattern reads each value once and keeps every test it cannot prove inert | A getter read twice; a dropped getter call |  | 26 |
| D369 | Module aliases and data-type methods come from a table pinned to the Effect version | A parameter's name is not part of a type |  | 11, 13 |
| D370 | Every `function*` is a producer; generator methods are JavaScript generators | An annotation must not choose the compiled form |  | 8 |
| D371 | A `for...of` loop means what its value is | Unions and `any` had no meaning |  | 8, 26 |
| D372 | One observation model judges every optimization and rewrite; the formatter keeps import order | Type-correct rewrites changed programs |  | 26, 28, 30 |
| D373 | The static guarantees state what they assume | A guarantee without its assumptions claims nothing |  | 26 |
| D374 | Implementation limits are restrictions, not rules | Lowering choices became language rules |  | 29, 30 |
| D375 | D310-D313 are decided; the platform import is D312's final form | The review of 2026-10-27 |  | 11 |
| D376 | A block after a call is always its last argument; a block after a dual is TypeScript's error with a note; a next-line block after a statement that ends in a name or a call is EK1022 | Placement by the callee's type broke the rule that call-site syntax decides |  | 5, 13, 28 |
| D377 | Every literal element of an await operation is deferred by syntax; an element's value, not its type, decides whether it runs or is waited for | D196 read fibers and Deferreds from types |  | 7, 13 |
| D378 | A call runs when its callee's declared return type, read before instantiation, is definitely an Effect: decision 5's static rule; `identity(program)` returns data | A TypeScript developer expects `identity(x)` to hand back `x`; no inference-driven timing |  | 13, 30 |
| D379 | The return boundary's S22-3 and S5-1 are removed: returning an Effect value never runs it; `return p()` | A contract's A decided whether a returned Effect ran |  | 13 |
| D380 | A function literal prefers the candidate that takes it as a function; opposed preferences are EK1021 | A lambda stays a lambda, as a TypeScript reader expects |  | 13 |
| D381 | A program is a function with no required parameters | The compiler's zero-required-input rule |  | 13 |
| D382 | A migration analyzer reports each site whose meaning changed but still type-checks, and each exported factory, as EK1023; `--fix` never guesses | No program changes meaning silently |  | 5, 13, 28 |
| D383 | `pipe` passes its first argument as the value it is | D110's look-ahead let a type decide a representation |  | 5, 13 |
| D384 | A declaration carries a plain function's `$plain` call signature; without one, passing the function as a plain callback is EK4301 | `[1, 2].map(double)` differed between source and declaration consumers |  | 10, 15, 27 |
| D385 | Every VibeLang function is, to TypeScript, a function returning a cold `Effect`, except plain-annotated functions and producers; inside VibeLang a call of a function declared to return an Effect runs it, and an arrow delays | One statement of settled decision 1 |  | Intro, 2, 10, 13 |
| D386 | An escaping block-owned fiber is EK4838, an error | One rule, one code |  | 7, 23, 28 |
| D387 | A file's entry statement and EK3205 depend on that file alone | An unrelated importer silenced EK3205 |  | 13, 28 |
| D388 | A value member named like a property of the key's class is EK4503 too | `Person.name` returned `"Person"` |  | 13, 28 |
| D389 | The trusted contract is `trusted(impl, [Errors])`; the D23 tags are deprecated | One form; a per-file renderer cannot see tags |  | 2, 10, 13, 26, 27 |
| D390 | A factory has no VibeLang form: TypeScript, a `module` declaration, or a plain function returning a function | Every candidate made a type decide when code runs |  | 5, 10 |
| D391 | `fork` and `join` are contextual keywords: `fork(e)` is the keyword with a parenthesized operand unless `fork` resolves to a binding the program declares; the await operations take a parenthesized operand too | Parentheses must not turn a deferred operand into a running call; recognition by binding (rule H) |  | 7, 13 |

#### Rules of the runtime and compiler

Proposed in the first draft as P1-P22; adopted by D29. A row marked **revised** changed after a verified counterexample.

| # | Rule | Evidence | Chapters |
| --- | --- | --- | --- |
| P1 | The machine in Chapter 20 is the specification. Every feature is a rule over it | Chapter 18 | All |
| P2 | Runtime: Effect-native prompts (strategy A). Reference semantics: an explicit machine (strategy B), once G16 runs one law suite on both. **Revised**: the two disagree today on the Context a reinstalled prompt records , so passing tests in both are not agreement | {{testCount}} kernel tests; 20 reference tests; T7a; `tests/runtime-boundaries.test.ts` | 25 |
| P3 | Deep handlers, dynamic selection, clauses run outside their prompt | T9, clause-outside test | 20 |
| P4 | Context is a snapshot across capture; the reinstalled prompt records the resume site's Context | T1, T13, T15 | 22 |
| P5 | Every consumption of a continuation (resume, transfer, abandon) happens on the capturing fiber | T14, T14b, O04, O06 | 21 |
| P6 | A second resume is a defect at the caller; a root wait that loses a race reports it | T2, T5a-T5c | 21 |
| P7 | An owner frame abandons an unresumed continuation. `transfer` (standard library only) moves ownership to the Scope region around the handler, revokes an earlier transfer, and rejects ownership cycles and parallel Scopes. **Revised**: the capturing fiber's exit is a second owner, so a transfer never outlives its fiber  | T3, T4, T10, O01-O08, K13a-K13e | 21 |
| P8 | Abandonment unwinds like interruption and never disturbs real pending interruptions; a masked handler that swallows it is re-raised. **Revised**: every cleanup failure is reported beside pending interruptions, on every abandoning path  | kernel-edges, A01-A04, I03, I10, I11, K12a-K12e | 20, 23 |
| P9 | Services always use in-place evidence. Control operations use prompt evidence, or in-place evidence when TypeScript supplies an implementation that always resumes; the checker treats them as fiber-bound either way | In-place and override tests; T8 | 4, 9, 16 |
| P10 | Control operations cannot cross fibers. **Revised**: the runtime is the guarantee (`HandlerNotOnThisFiber`); the fiber-behavior table is the diagnostic (EK4201), and TypeScript functions with a control operation in R are rejected (EK4202) | T7b, T8, probes; `tests/runtime-boundaries.test.ts` | 9, 16 |
| P11 | The frame invariant; source regions compile to Effect frames, never JavaScript `try`, in functions that compile to frames | F1-F3 | 26 |
| P12 | **Revised** as D10: plain JavaScript only with no Effect operation and E = never; bounded eager pure recursion, then heap frames (D10); `pure` permits inlining only | F9, T6a; `tests/runtime-boundaries.test.ts` | 15 |
| P13 | The kernel bounds synchronous wake-up depth | F10a, K10a, K10b | 24 |
| P14 | A callback type without a contract is effect-polymorphic (D12); D57 leaves this rule intact | Settled decision 2 | 16 |
| P15 | Effect 4 only | Research §10 | 10 |
| P16 | Fork `microsoft/TypeScript` `tsc/` at a published nightly; in-tree package; no shims | Compiler research | 27 |
| P17 | A declaration without a body states its full contract; a bare return type there is an error, never `never` | Settled decision 2 | 14 |
| P18 | **Revised** as D17: `resumeWith` may raise only the operation's declared E, and its R is `never` | Settled decision 3; `tests/runtime-boundaries.test.ts` | 9 |
| P19 | A finalizer's control operations must be handled inside the finalizer | I06, I11 | 17, 23 |
| P20 | Programs start only at runners; calls never create fibers; a module's top level cannot run a program (EK1001). **Revised**: runners are called only where no fiber runs the code (EK1005, D38) | Runner regression tests | 13, 23 |
| P21 | `for...of` over a producer is internal iteration; pulling from outside uses `transfer` | T10, T16 | 8, 26 |
| P22 | **Revised** as D18: a clause whose last action is `resume`, outside any region of the clause, compiles to `return tailResume(k, v)` and iterates in constant stack. The first draft's evidence, T17, covered only a `flatMap`-shaped clause | K11a-K11d; `tests/runtime-boundaries.test.ts` | 20, 26 |

#### Former open questions

| # | Question | Now |
| --- | --- | --- |
| O1 | How are program values spelled? | D7 |
| O2 | Declaration syntax for services and control operations? | D1, D2 |
| O3 | Does v0 expose the handler API? | D16 |
| O4 | Does `function*` mean producer? | D26 |
| O5 | Which owner does `fork` use? | D19 |
| O6 | Is `wire` a compiler intrinsic? | D27 |
| O10 | Does deep pure recursion overflow like JavaScript? | D10 |
| O11 | What does a call to plain TypeScript mean? | D5, D22, D23 |

#### Closed calls for the end-to-end build

| Former item | Decision | Result |
| --- | --- | --- |
| O7 | D57 (**controversial**), D308, D309 | `infer Name` marks an inferred channel; a slot left out of `Effect<…>` is `never`; D12 stands |
| O8 | D59 | Upstream issues and proposals are drafted in `docs/upstream/`, not filed |
| O9 | D58, superseded by D125, then D255 (**controversial**) | VibeLang: `vibelang`, `.vibe`, `EK` codes, and unscoped npm packages |
| Remote and repository layout | D60 | One repository, with the compiler in `typescript/`: public at `github.com/smithersai/vibelang` |

No language or repository decision remains open here. Limits of the implementation are restrictions, listed in Chapter 30 (D374). Upstream drafts require maintainer approval before filing.
