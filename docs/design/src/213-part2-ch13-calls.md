## Part II. The rules

Part I showed the language by example. This part states its rules precisely, still from the programmer's side; Part III explains how the runtime carries them out.

### 13. What a call means

#### The principle

Calls work exactly as a TypeScript developer reading the code expects. Read every call of an effectful function as if it had an implicit `await`:

- A call does its work where it stands.
- Its callee and arguments are evaluated once, left to right, before the call, as in JavaScript.
- Its value is what the callee returns. For an effectful callee, that is the success value; a failure propagates as a thrown error does.
- Delaying work means writing a function, `() => f(x)`, as in TypeScript.
- No type, annotation, union, overload, or name spelling changes when, whether, or how often code runs. A type may reject a program; it never changes what a program does.

This is the test for every rule in Part II: if a TypeScript developer reading a call would be surprised by when or how often something runs, the rule is wrong (D320). Kotlin's suspending functions work the same way: a call to one suspends where it stands, after its arguments are evaluated, and only a lambda delays work.

```ts es
const user = fetchUser(id)                        // runs here: user is a User
const name = user.name.trim()
const fresh = retry(() => fetchUser(id), policy)  // the arrow delays: retry runs it per attempt
const later = () => fetchUser(id)                 // nothing runs
const again = later()                             // runs now
```

#### Two verbs

This part uses two verbs. To **evaluate** an expression is to compute its value, as JavaScript does; evaluating a call that runs includes running it. To **run** a program is to execute it on the current fiber until it succeeds or fails. A **program** is a value that describes work without doing it: a VibeLang function with no parameters, or an `Effect` value. Building a program does none of its work; each run of it does all of it again, with fresh local bindings.

#### Three kinds of call

Every call expression, `f(args)`, `o.m(args)`, `f?.(args)`, `o?.m(args)`, or a tagged template `` f`…` ``, is exactly one of three kinds. Its syntax and the signature its callee resolves to decide which; nothing else does.

| Kind | Trigger | Meaning |
| --- | --- | --- |
| Run | The resolved signature's declared return type is definitely an Effect, or the callee is a program value | Evaluate the callee and the arguments, run the returned program on this fiber, and take its success value |
| Plain | Every other call, and every `new` | JavaScript's call: the value is what the callee returns |
| Escape | The callee resolves to the prelude's `sync`, `try`, or `callback` | The first argument is TypeScript, run when the hatch runs (Chapter 10) |

**Rule R (run).**

- *Trigger.* A call whose callee resolves to a signature whose declared return type is **definitely an Effect**: the `Effect` interface, `Effect<A, E, R>` or `A!E!R`, with any type arguments, written directly or through a type alias; a conditional type each of whose branches is definitely an Effect or `never`, such as the `All.Return<…>` that `Effect.all` declares; or a union each of whose members is definitely an Effect (D270). Also `p()`, where `p` is not a function and its type is definitely an Effect or extends `Effect`: calling a program value runs it.
- *Not a trigger.* A type parameter, `any`, `unknown`, an intersection, a union with any other member (`Effect<A> | undefined`), and an interface that extends `Effect` with structure of its own: `Config` (`Config.ts:113`), `Exit` (`Exit.ts:89`), a service key (`Context.ts:68`), an error instance (`Cause.ts:1312`). A call returning one of these returns it as data.
- *Static check.* The signature is the one TypeScript resolves for the call, read before its type parameters are instantiated, so no instantiation, expected type, or annotation on a receiving binding changes whether a call runs. The call's type is the success type A. Its E and R join the caller's contract (Chapter 14). A call that runs is EK1001 where no program runs the code: a module's top level, a class field initializer, a parameter default, a constructor, an accessor, or a static block (D282). It is EK2003 under a plain contract and EK4301 in a plain callback.
- *Runtime.* Evaluate the callee and the arguments (rule E below), then run the program the call returns on the current fiber. The call's value is the program's success value. If the program fails, the failure propagates, and nothing to the right of the call is evaluated.

```ts es
const user = Users.find(id)              // a service member returning User!UserNotFound: runs
const report = loadReport(id)            // a VibeLang function: runs
const row = findUser(id)                 // a TypeScript function returning an Effect: runs
const both = all([() => a(), () => b()]) // Effect.all's conditional return type: runs
const port = Config.Port("PORT")         // returns Config<number>: data
const done = Exit.succeed(1)             // returns Exit<number>: data
const same = identity(program)           // returns T: data, whatever T is
const value = port()                     // calling a program value runs it
```

"Definitely" keeps the rule independent of inference. `identity` returns whatever it receives, and a TypeScript reader expects `identity(program)` to return the program. `Effect.all` returns an Effect for every argument it accepts, so every call of it runs. A `Config` stays data so that `Config.withDefault(Config.Port("PORT"), 3000)` composes before anything reads the variable, and a function that returns `new InvalidId({ raw })` returns the error instead of failing with it.

**Rule P (plain).** *Trigger:* every call that is not of kind Run or Escape, and every `new C(…)`. *Static check:* the callee is a VibeLang function that compiles to plain JavaScript, or a trusted function; any other TypeScript or JavaScript function is EK4401, a platform API EK4402, and a clock or randomness read EK4403 (Chapter 10). *Runtime:* JavaScript's call. A plain call that returns an Effect value returns it as data: discarding it is EK4801, and returning it where the success type names no value is EK4802.

**Rule X (escape).** Chapter 10 defines the hatches.

| The callee is | Kind | Generated |
| --- | --- | --- |
| A VibeLang function with an Effect contract, inferred or written | Run | `yield* f(a)`, or `f$direct(a)` when it compiles to plain JavaScript (Chapter 15) |
| A VibeLang function with a plain return annotation (D67) | Plain | `f(a)` |
| A TypeScript function whose declared return type is definitely an Effect | Run | `yield* f(a)` |
| A TypeScript function whose R contains a control operation | Rejected in v0: EK4202 (Chapter 9) | |
| A program value, `p()` | Run | `yield* p` |
| A service member, `Users.find(id)` | Lookup, then Run or Plain by the member's type | `yield* (yield* Users).find(id)`; `(yield* Path).join(a, b)` |
| A control operation, `Approval.approve(x)` | Lookup, then the nearest handler on this fiber | `yield* (yield* Approval).approve(x)` |
| A method of an Effect data type, `fiber.join()` | The module's function, then Run or Plain by its type | `yield* Fiber.join(fiber)`; `Stream.take(stream, 3)` |
| A JavaScript built-in, or an `effect` export that does not return an `Effect` | Plain, trusted: listed exceptions join E | `f(a)`, with listed exceptions converted |
| A TypeScript function wrapped with `trusted(impl, [Errors])` (D249, Chapter 10) | Run: the wrapper returns an `Effect` | `yield* f(a)` |
| A TypeScript function with the deprecated `@vibelang trusted` tag (D23) | Plain, trusted, with warning EK4406 (D249) | `f(a)`, with listed exceptions converted |
| Any other plain TypeScript or JavaScript function | Rejected: EK4401 (Chapter 10) | |
| A platform API, or a clock or randomness read | Rejected: EK4402, EK4403 (Chapters 10, 11) | |
| `sync`, `try`, `callback` | Escape | Chapter 10 |
| `new C(…)` | Plain: constructs, never runs a program | `new C(…)` |

Because the kind of a call depends on its callee's declared signature, the compiler needs TypeScript's type checker, not a source transform, so VibeLang is a fork of the TypeScript compiler (Chapter 27). These rules define the language. An implementation that cannot apply them to a program rejects the program; it never gives the program another meaning.

#### Services, control operations, and data-type methods

Three call forms are shorthand for calls that rules R and P already cover. Each is recognized by the symbol its receiver resolves to (rule H).

- **Services.** Where `S` resolves to a service key, a `service` declaration, a `Context.Service` class, or a module whose name names its key (D311), `S()` looks the implementation up in the current Context: a call that runs and adds `S` to R. `S.m(args)` is `S().m(args)`: the lookup, then the member, then the arguments, then the call, which runs when the member's declared type returns an Effect and is a trusted plain call otherwise. `S.v()`, where the member `v` is an Effect value, looks the service up and runs `v`. A value member read without a call is EK4503.
- **Control operations.** `C.op(args)`, where `C` is a control declaration, looks the operation up as a service call does and asks the nearest handler on this fiber (Chapter 9).
- **Data-type methods.** `x.name(args)` is `Module.name(x, args)` (D152) when all of these hold: the access is in a `.vibe` file and not in an optional chain; `x`'s type, with type parameters resolved to their constraints, has no member `name` of its own; one of Effect's data-type modules declares `x`'s type, and for a union every member comes from the same module, as `None` and `Some` come from `Option`; and the method table lists `Module.name`. The table holds each function whose data-first overload takes the module's type first. It is generated from the declarations of the Effect version the runtime pins, ships with the compiler, and changes only with a VibeLang release that changes that pin (D336). A parameter's name plays no part.

The method's signatures are its data-first overloads with the first parameter moved to `this`; a curried overload, such as `Stream.zipLeft(right)`, is not one of them. TypeScript checks `x` against it, infers type parameters from it, and narrows `x` by a type predicate on it:

```ts es
function describe(value: Option.Option<number>) {
  if (value.isSome()) return `some ${value.value}`   // Option.isSome(value): value is Some<number>
  return "none"
}
```

The call compiles to `Module.name(x, args)`, and rules R and P apply to that call: `Fiber.join` returns an `Effect`, so `fiber.join()` runs; `Stream.take` returns a `Stream`, which is data. The method exists only in a call: `const read = maybe.getOrElse` is EK4501 (D153), because no function value exists to bind; pass `Option.getOrElse` itself.

#### Programs are built by syntax

**Rule D (delay).** *Trigger:* these forms, and no others, build a program.

| Form | The program it builds |
| --- | --- |
| A function literal: `() => e`, `() => { … }`, `function () { … }` | Its body, run each time the function is called |
| A block after a call, `f(args) { … }` (D188) | `() => { … }`, passed to `f` |
| `fork e`, `fork { … }` (D166) | `() => e`, run on a new fiber |
| An element of an array or object literal after `await.all`, `await.allSettled`, `await.race`, or `await.any` (D196) | `() => element`, each started on its own fiber |
| The left side of `x catch y` and `x catch (e) => …` (D236) | `x`, evaluated inside the catch |
| The block of `provide L { … }`, `uninterruptible { … }`, `restore { … }`, `interruptible { … }`, and a `for concurrent` body | The block |
| A hatch's first argument | TypeScript, run when the hatch runs (Chapter 10) |

*Static check:* none beyond the form's own. *Runtime:* evaluating the form evaluates nothing inside it. Each run evaluates the body from the start (rule E8).

A program passes to a TypeScript API in the representation the API declares. Where the declared type at the destination is the `Effect` interface, or a type parameter whose constraint includes it and no function type, a function with no parameters, written there or passed as a value, is passed as an `Effect` that calls the function each time it runs (D7, D69). An array, iterable, or record of such functions converts element by element (D49, D111). The same holds for a declared variable, field, or contextually typed object-literal field whose type is an Effect: `const tick: void!! = () => log("tick")` holds a program. The conversion changes the representation, never what runs or when: building the `Effect` runs nothing.

```ts gen
// retry(() => syncInventory(store), Schedule.recurs(3))
yield* Effect.retry(Effect.gen(function* () { return yield* syncInventory(store) }), Schedule.recurs(3))
// retry(job, Schedule.recurs(3)), with const job = () => syncInventory(store)
yield* Effect.retry(Effect.suspend(job), Schedule.recurs(3))
```

**A call where a program is expected.** A call that runs, written where the declared type at its destination (see Function values, below), or an element or field type of it, is the `Effect` interface or a function with no parameters that returns one, runs before anything receives it. Unless its success value is itself an Effect, that is EK1018, whose quick fix writes `() =>` before the call. It covers arguments, array elements, object-literal fields, and initializers of a `const` declared with an Effect type:

```ts es
function load(id: string) {
  return retry(fetchUser(id), Schedule.recurs(3))
}
```

```text
error EK1018: fetchUser(id) runs here, before retry receives it, but retry expects a program.
  load.vibe:2:16   return retry(fetchUser(id), Schedule.recurs(3))
  Write () => to pass the program:   retry(() => fetchUser(id), Schedule.recurs(3))
```

EK1018 also covers a call whose success type is `never`, such as `race(Effect.fail(a), Effect.fail(b))`: the first call would fail before `race` started.

Earlier versions passed such calls by name, held typed initializers, and ran some returned values; each of those sites now gets its behavior from syntax:

| Earlier form | Now | Where the behavior comes from |
| --- | --- | --- |
| `retry(fetchUser(id), policy)` | `retry(() => fetchUser(id), policy)` | A function literal (rule D) and its conversion |
| `fork(fetchReport())` | `fork fetchReport()` | The `fork` keyword |
| `Effect.all([a(), b()])` | `await.all [a(), b()]`, or `all([() => a(), () => b()])` | The await operation; function literals |
| `timeout(slow(), "1 second")` | `timeout(() => slow(), "1 second")`, or `timeout("1 second") { return slow() }` | A function literal; a block param |
| `fetchUser(id) \|> retry(%, policy)` | `retry(() => fetchUser(id), policy)`, or `retry(policy) { return fetchUser(id) }` | The pipe's topic is a value (Chapter 5) |
| `race(do { … }, fetched())` | `race(() => { … }, () => fetched())` | Function literals |
| `const p: number!! = make()` | `const p = () => make()` | A function literal |
| `{ read: work() }`, where `read` is an Effect | `{ read: () => work() }` | A function literal and its conversion |
| A factory: `(input): number!! => { …; return () => snapshot }` | A plain function returning a program, or TypeScript (Chapters 5, 10) | The returned function literal |
| `HttpRouter.add("POST", "/users", createUser())` | `HttpRouter.add("POST", "/users", () => createUser())` | A function literal |
| `NodeRuntime.runMain(main())` | An exported `main` with a platform import (D312), or `NodeRuntime.runMain(main)` | The entry, or a function value |

#### Programs and continuations

This document has two kinds of "rest of the work", and they behave differently: a **program** is the reusable kind; a **continuation** is the `k` a handler receives in Chapter 9.

| | Program | Continuation |
| --- | --- | --- |
| What it is | A description of work that has not started | The rest of one particular run, paused at a call |
| Created by | A form of rule D; importing an `Effect` | A control operation, when a handler receives it |
| How many times it runs | Every time it is run | At most once |
| Retry | Runs it again from scratch, with fresh local variables | Impossible: it has been used |
| Other fibers | Can run on any fiber (`fork`) | Only on the fiber that created it |
| Type | `() => A` with contract `Effect<A, E, R>`, or `Effect<A, E, R>` where a declared type asks for one | `Continuation<V, E, H>`, usable only inside its clause (Chapter 9) |

#### Function values

A function literal, or a named function used as a value, is always a function: nothing turns it into a call. What it compiles to depends only on the declared type at its destination: the parameter type of the signature TypeScript selects, a declared variable, field, or return type, or the field type of a contextually typed object literal (D44). A type parameter counts as instantiated when another argument or an explicit type argument fixes it; one that only the function itself fixes counts as no type, since reading it would make the function decide its own form.

| Declared type at the destination | The function compiles to |
| --- | --- |
| A function type returning a type that is definitely an Effect, or a contract-less callback parameter of a VibeLang function (Chapter 16) | Its Effect form: a call returns a program that runs the body |
| A function type returning any other type, `void`, `unknown`, `any`, and a type parameter included, as `Array.prototype.map` expects | Its plain form (Chapter 15). A body that can pause, or whose `throw` can escape, is EK4301; a trusted call's listed failures are defects there (D101) |
| A function type whose return type is a union of an Effect and other types, `boolean \| Effect<boolean>` | Its plain form when its body performs no Effect operation and cannot fail, its Effect form otherwise (D112). The destination declares that it accepts both |
| `Effect<A, E, R>`, or a type parameter whose constraint includes an Effect and no function type, for a function with no parameters | A program (rule D's conversion) |
| A type that includes both a function type and an Effect, as `HttpRouter.add`'s handler does | A function, compiled by the function member; never a program |
| None, as for a function that another function returns | Its plain form when Chapter 15 allows, its Effect form otherwise |

Both forms run the body when the function is called. They differ in what the call returns: a value, or a program that the caller's code runs at once. A function never becomes a program because its body can pause: `HttpRouter.add("GET", "/health", () => checkHealth())` passes a handler function, whatever `checkHealth` does, and the router calls it.

Overload resolution is TypeScript's. Candidates are tried in TypeScript's order, declaration order after its `reorderCandidates` step, and the first that accepts every argument wins (D56). A function literal's type includes its contract, as an `async` function's type includes its `Promise`, so a candidate that asks for a plain function does not accept one whose body can pause or fail:

```ts dts
// helpers.d.ts: a plain callback first, an Effect callback second
import { Effect } from "effect"

// The package is listed in vibelang.trustedPackages (Chapter 10).
export declare function register(f: (x: number) => number): string
export declare function register<E, R>(f: (x: number) => Effect.Effect<number, E, R>): Effect.Effect<string, E, R>
```

```ts es
const a = register((x) => Math.max(x, 0))                    // plain: overload 1 accepts it
const b = register((x) => Users.find(String(x)).id.length)   // Effect function: overload 2, and the call runs
```

Against overload 1, `b`'s function would have to be plain, and it calls a service, so overload 1 fails and overload 2 accepts it. Swap the overloads and `a`'s function becomes an Effect function, as declaration order picks a signature in TypeScript. Resolution picks a signature and so a form; it never changes when an argument is evaluated, because every argument other than a function literal is evaluated as a value, once, whatever the candidate.

#### Evaluation order and binding time

**Rule E.** Every expression is evaluated in JavaScript's order, each operand once, and a call that runs runs at its place in that order (D326). Precisely:

- **E1. Operands.** Operands are evaluated left to right, each exactly once, as ECMAScript evaluates them. A call evaluates its callee reference, receiver then member, before its arguments, and keeps the receiver as `this` (ECMAScript EvaluateCall, 13.3.6.1). A property read, a getter included, happens once per access written. An assignment evaluates its target reference before its right side; a compound assignment reads its target once and writes it once. A spread argument iterates once. A tagged template evaluates its tag reference, then its substitutions left to right, then calls the tag with the site's one template object (D267).
- **E2. Calls that run.** A call that runs runs after its callee and all its arguments are evaluated, and before anything to its right is evaluated. A pause inside it keeps every value already evaluated: no operand is evaluated again when the fiber resumes. If it fails, nothing to its right is evaluated, as after a `throw`.
- **E3. Service and control calls.** `S.m(args)` looks the service up, then reads the member, then evaluates the arguments, then calls, as `S().m(args)` does under E1. A missing service fails at the lookup, before any argument is evaluated.
- **E4. Short circuits.** In `a || b`, `a && b`, `a ?? b`, and `c ? x : y`, the left operand or the condition is evaluated first, a call that runs included, and its value, the success value and never a program, is tested. The right operand or the branch not chosen is not evaluated.
- **E5. Optional chains.** In `o?.m(args)`, `f?.(args)`, and `o?.[k]`, when the value before `?.` is `null` or `undefined`, the whole chain is `undefined` and nothing to its right is evaluated: no member read, no argument, no call. Otherwise the chain continues under E1 to E3, and `f?.(args)` runs when `f`'s declared return type is definitely an Effect (D68).
- **E6. Pipes.** `x |> body` evaluates `x` once, before anything in the body, and `%` is its value; then the body is evaluated under E1. A name the body reads is read after `x` is evaluated, so the body sees what evaluating `x` changed. A function in the body that reads `%` keeps the value of the evaluation that created it (D325).
- **E7. Forms with operands.** A keyword form evaluates its own operands in the order written, before it starts any program. `for concurrent(n) (const x of xs)` evaluates `n`, then `xs`, then iterates `xs` once. `provide A, B { … }` evaluates `A`, then `B`. `wire(a(), b())` evaluates `a()`, then `b()`, then builds the layers in dependency order. `join e`, and an await operation whose operand is not an array or object literal, evaluate `e` once and read each element or own enumerable property once, in ECMAScript's order, and use that one reading both to wait and to interrupt; an await operation reads an iterable operand when it starts, on each run. A hatch evaluates its function, then its mapper, then its inputs (Chapter 10).
- **E8. Programs.** Evaluating a form of rule D evaluates nothing inside it. Each run of the program evaluates its body from the start under E1 to E7. Locals declared inside are fresh on each run. A binding captured from outside is read when the body reads it, so a run sees the binding's current value, not a copy taken when the program was built.
- **E9. Call time and run time.** For a VibeLang caller, call time and run time are one moment: a call that runs evaluates its arguments, then runs the callee's program at once. They are two moments for a TypeScript caller, which receives the program (Chapter 10), and for a program value run more than once. Bound once per call: the receiver and the argument values. Bound once per run: the parameters, from those argument values, with default values evaluated, destructuring and rest parameters performed, and a fresh `arguments` object; then the body runs.
- **E10. Coldness.** Building a program, by rule D or by calling a VibeLang function from TypeScript, runs none of its work: no statement of its body, no parameter default, no getter its body reads. Coldness does not promise sameness: each run does the work again, and work outside the language, such as a Promise already started that the program captured or a memoized `Effect.cached` value, keeps its own behavior. Fresh frames are not fresh resources.
- **E11. Equivalence.** Every compiled form of a program, optimized or not, produces the observations of the frame lowering in Chapter 26: the same success value; the same Exit, with the same reasons in the same order; the same calls, getter reads, and side effects, in the same order and number; the same bindings and lexical context; and the same resource and fiber lifetimes. This binds the plain path (Chapter 15), single-result bodies (D274), the last arm of an exhaustive match (D294), operand hoisting, pipe substitution, and every automatic fix that claims to keep a program's meaning (Chapter 28). An optimization that cannot establish this for a program is not applied to it.

When each part of a program is evaluated:

| Expression | Evaluated or run | How often |
| --- | --- | --- |
| An argument | Before the call, where the call stands | Once per evaluation of the call |
| A function body, its parameter defaults and destructuring | When its program runs; for a VibeLang caller, at the call | Once per run |
| A function literal's body, a block param, `fork`'s operand, an await operation's element | When the program runs: `fork`'s and the await elements' on their own fibers | Once per run |
| `x catch y` | `x` where the expression stands, inside the catch; `y` only after an expected failure | Once per evaluation |
| The service lookup in `S.m(args)` | At the call, before its arguments | Once per call |
| A service read in a layer's body | When the layer is built (Chapter 4) | Once per build |
| A hatch's function, or its single expression | When the hatch runs, after its mapper and inputs | Once per run of the hatch |
| A pipe's left side | Before its body | Once per evaluation of the pipe |
| `using`'s disposal method | When the resource is registered, and called with the resource as `this`, as ECMAScript's explicit resource management does | Once |
| A module's top level, plain calls included | When the module is first imported | Once |
| A class field initializer, a constructor, an accessor, a static block | As JavaScript runs them, as plain code (D282) | As JavaScript does |

ECMAScript's evaluation order and Kotlin's suspending calls are the prior art: the operands come first, the suspension point is the call, and only a lambda delays.

#### Lexical context

**Rule L.** Every lowering keeps JavaScript's meaning of `this`, `arguments`, `new.target`, `super`, private names (`#x`), and a named function expression's binding of its own name (D327). Precisely:

- **L1. Source activations.** A function written in the source keeps its own activation: an ordinary function or method has its own `this`, `arguments`, `new.target`, and home object for `super`; an arrow function has none and reads its enclosing function's, as ECMAScript defines them (10.2). A function the compiler generates, such as a generator frame, a region closure, a thunk, the arrow that a `do` or `throw` expression becomes, a handler clause's body, a producer body, a pipe temporary, or a plain-JavaScript variant, is not a source activation: each of these names in it means what it means in the source function that contains it.
- **L2. Self reference.** A named function expression's name refers to that function inside it, whatever the generated function is called, and a call of it is a call of the source function.
- **L3. `super`.** `super.m()`, `super.x`, `super[k]`, `super.x = v`, `super.x += v`, and `super[k]++` read and write as JavaScript does, with the home object and receiver of the source method, and a computed key evaluated once (E1).
- **L4. Through pauses and runs.** These bindings keep their identity through a pause and on every run: the receiver bound at the call is `this` in every run, and `arguments` is the run's own activation object (E9).
- **L5. Blocks that are expressions.** A `do { }` expression is a block evaluated where it stands. A `break` or `continue` that would leave it, and a `var` declaration inside it, are EK1019, since its lowering cannot carry them out of the block; a `return` inside it is TS1108 (D187).
- **L6. Constructors.** A function declared in a `.vibe` file is not a constructor; `new` on one is EK1020. A class is the form that constructs, and its constructor runs as plain JavaScript (D282).
- **L7. No silent change.** A form whose lowering cannot keep one of these meanings is a compile error that names it.

TypeScript's own downlevel emit for generators and async functions keeps the same bindings with `_this`, `_arguments`, `_newTarget`, and `_super` temporaries.

#### Names

**Rule H.** Every name the compiler introduces is fresh, every source name keeps its binding, and every feature is recognized by the symbol a name resolves to, never by its spelling (D328). Precisely:

- **H1. Fresh names.** Every binding the compiler introduces, such as a temporary, a generated function, a plain-JavaScript variant, a region closure, a pattern's capture, a service's generated base class, or an alias for an import, is distinct from every source binding in every scope where it is visible, and from every name the source there can reference. The names in this document's generated listings, such as `double$direct` and `$match1`, are illustrative.
- **H2. Fixed references.** A source identifier keeps the binding it resolves to in the source, wherever a lowering moves it. A reference the compiler writes to a runtime function or an Effect function goes through an import binding that the compiler owns, so no source declaration can shadow it or be captured by it.
- **H3. Nothing reserved.** No identifier that TypeScript allows is reserved by VibeLang's output: a local named `runtime`, `Effect_1`, `answer$direct`, `$match1`, `scope`, `SyntaxError`, or `Users_base` behaves like any other name. A name that a declaration publishes on purpose, such as a data type's variant, is diagnosed when it collides (EK2124); it never captures.
- **H4. Recognition by symbol.** A rule that gives a name a special meaning applies only when the name resolves, through import aliases and re-exports, to the declaration the rule names. This covers runners (D38, D135), hatches (D148), `pipe`'s program argument (D110), `wire` (D27), the prelude's functions, the built-in matchers such as `Option.Some` and `Number` (D208), the data-type method table (D152), a module's same-named export (D311), a function's trusted contract, and every exception list a diagnostic uses. A local declaration with the same spelling is an ordinary binding without that meaning; an alias of the declaration has all of it.
- **H5. Keywords.** `fork e`, `join e`, `await.all`, `await.allSettled`, `await.race`, `await.any`, `provide L { }`, `x catch y`, `do { }`, `match`, `is`, `using`, `for concurrent`, and the mask blocks are syntax and never consult scope: a local named `fork` or `join` changes none of them. A call written with parentheses, `fork(x)` or `join(x)`, is an ordinary call of whatever the name resolves to.
- **H6. Declarations.** Declaration files follow H1 and H2: an import that a `.d.ts` adds for a prelude type uses a fresh alias (D123), and no generated declaration collides with an export.
- **H7. Renaming.** Renaming a source binding consistently, to any name TypeScript allows there, never changes what a program does. The conformance suite renames the locals of its cases to the names the compiler generates and to the runtime's export names, and compares the results.

Hygienic macro expansion (Kohlbecker and others, 1986; R7RS 4.3), Racket's sets of scopes, and TypeScript's own `createUniqueName` are the prior art; ECMAScript's ResolveBinding is the standard that H4 follows.

#### Where programs start

A call never starts a fiber; a program starts only when a **runner** receives it. The compiler recognizes runners by their resolved symbols (rule H4): `Effect.runPromise`, `runPromiseExit`, `runSync`, `runSyncExit`, `runFork`, `runCallback`, and their `*With` forms; `ManagedRuntime`'s `run*` methods; `NodeRuntime.runMain` and `BunRuntime.runMain`; and `@effect/vitest`'s `it.effect`, `it.live`, their `.each` and `.prop` forms, and `layer(…)`.

A program's entry is an exported `main` in a file that names its platform (D135, D312):

```ts es
// main.vibe
import "vibelang/platform/node"

export function main() {
  const name = Effect.provide(() => welcome("42"), AppLive)
  log(`welcomed ${name}`)
}
```

When the host starts this module, its entry statement runs `main` with Node's runner and the platform's services; importing the module runs nothing. A TypeScript entry file works too, because `main()` returns an ordinary cold `Effect` there:

```ts ts
// run.ts
import { NodeRuntime } from "@effect/platform-node"
import { main } from "./main.js"

NodeRuntime.runMain(main())
```

A module that exports a function declaration named `main` with no parameters gets an entry statement, unless it already calls a runner at its top level (D135). The suppression test is rule H4's: a top-level call whose callee resolves to a runner's declaration, never a call that merely shares a runner's name, such as `helper.runSync(1)` on an object of the program's own. The entry statement uses `runtime.$entry` to start `main` only when the host starts this module, so importing it starts nothing; the helper checks the started file's exported `main` in bundles and CommonJS output, so an imported module's `main` does not start with the entry module's. The runner is `NodeRuntime.runMain` when `@effect/platform-node` resolves from the module, and the runtime's `$runMain` otherwise. A `main` that compiles to plain JavaScript runs through `Effect.sync`. An explicit top-level runner supplies its own layers and options and replaces the generated entry. Whether a file gets an entry statement, and what it provides, depends on that file alone: no other file's imports enter either decision.

A module's top level is inside no program. A call there may build values, such as `Layer.effect(…)`, `wire(…)`, `Config.Port(…)`, or `Schedule.exponential(…)`, and plain calls run there, but a call that runs a program is EK1001:

```ts es
// config.vibe
export const config = loadConfig()
```

```text
error EK1001: loadConfig() runs a program, but a module's top level is not inside one.
  config.vibe:2:23   export const config = loadConfig()
  Export a function instead, or provide the value as a service with a Layer.
```

A runner is called only where no fiber runs the code: a module's top level, or a plain callback that such a place passes to a TypeScript function, such as a `describe` body or a web framework's route handler. In code a fiber runs, a runner would start a new root with an empty Context and no handlers, outside the caller's structured concurrency:

```ts es
function refreshAll(ids: ReadonlyArray<string>) {
  for (const id of ids) Effect.runFork(() => refresh(id))
}
```

```text
error EK1005: Effect.runFork starts a new root fiber, but refreshAll already runs on one.
  refresh.vibe:2:25   for (const id of ids) Effect.runFork(() => refresh(id))
  Fork it so the block owns it:   fork refresh(id)
```

Tests in `.vibe` use `it.effect`. A test that must `await` a Promise stays in a `.ts` file.

#### Blocks as values

A `do { }` expression (D187, the TC39 [do expressions](https://github.com/tc39/proposal-do-expressions) proposal) has the value of its last statement. It is evaluated where it stands, like any expression, and builds no program. To pass a block as a program, write a function literal or a block param. An await operation's element is already a program, so a `do` there gives the element statements of its own:

```ts
function cached(): string!! {
  sleep("1 millis")
  return "cached"
}

function fetched(): string!! {
  sleep("1 second")
  return "fetched"
}

function firstSuccess() {
  return race(() => { const value = cached(); return value.toUpperCase() }, () => fetched())
}

function firstToFinish() {
  return await.race [do { const value = cached(); value.toUpperCase() }, fetched()]
}
```

#### Blocks after calls

A block on the same line after a call or a name is a program passed to that call (D188, the TC39 [block params](https://github.com/samuelgoto/proposal-block-params) proposal): `f(args) { block }` passes `() => { block }`. The block is a program wherever it goes, and the written arguments are evaluated left to right before the call wherever it goes (E1), so its place never changes when anything runs (D334). Its place comes from the callee's resolved declaration, an Effect dual's program position first: when a signature takes a program first and the written arguments after it, the call is `f(block, args)`; otherwise, when a signature takes the written arguments and returns a function whose one parameter is a program, it is `f(args)(block)`; otherwise the block is the last argument, `f(args, block)`. The call infers its type parameters from the arguments and the block together:

```ts
function work(): string!! {
  sleep("1 millis")
  return "done"
}

function guarded() {
  const semaphore = Semaphore.make(1)
  const result = semaphore.withPermits(1) {
    return work()
  }
  return withSpan("guarded") {
    return result.toUpperCase()
  }
}
```

The block is a function body, so a value needs `return`. Blocks nest, which is how several combinators wrap one program:

```ts es
function loadUser(id: string) {
  return withSpan("load-user") {
    return timeout("2 seconds") {
      return retry({ times: 3 }) {
        return fetchUser(id)
      }
    }
  }
}
```

`retry` runs the innermost block on each attempt, `timeout` bounds the retried work, and `withSpan` traces both.
