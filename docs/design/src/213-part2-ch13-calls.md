## Part II. The rules

Part I showed the language by example. This part states its rules precisely, still from the programmer's side; Part III explains how the runtime carries them out.

### 13. What a call means

#### The principle

Calls work exactly as a TypeScript developer reading the code expects. Read every call of an effectful function as if it had an implicit `await`:

- A call does its work where it stands.
- Its callee and arguments are evaluated once, left to right, before the call, as in JavaScript.
- Its value is what the callee returns. For an effectful callee, that is the success value; a failure propagates as a thrown error does.
- Delaying work means writing a function, `() => f(x)`, as in TypeScript.
- Whether a call runs is read from the declared return type of the signature the call resolves to, as a TypeScript reader reads `Promise` off a signature. Overload resolution picks that signature as TypeScript does, from the arguments' own types (rule F). No instantiation, annotation on a receiving binding, parameter type, or name spelling changes when, whether, or how often an operand is evaluated or a call runs, and the order of overloads never decides a function argument's form. A type may reject a program; in the places [Where a type decides](#where-a-type-decides) lists, and only there, it also decides what a program does, and each entry says what it decides and what it never decides.

This is the test for every rule in Part II: if a TypeScript developer reading a call would be surprised by when or how often something runs, the rule is wrong (D320). Kotlin's suspending functions work the same way: a call to one suspends where it stands, after its arguments are evaluated, and only a lambda delays work.

```ts es
const user = fetchUser(id)                        // runs here: user is a User
const name = user.name.trim()
const fresh = retry(() => fetchUser(id), policy)  // the arrow delays: retry runs it per attempt
const later = () => fetchUser(id)                 // nothing runs
const again = later()                             // runs now
```

#### Two verbs

This part uses two verbs. To **evaluate** an expression is to compute its value, as JavaScript does; evaluating a call that runs includes running it. To **run** a program is to execute it on the current fiber until it succeeds or fails. A **program** is a value that describes work without doing it: a function with no required parameters, or an `Effect` value (D381). Building a program does none of its work; each run of it does all of it again, with fresh local bindings.

#### Three kinds of call

Every call expression, `f(args)`, `o.m(args)`, `f?.(args)`, `o?.m(args)`, or a tagged template `` f`…` ``, is exactly one of three kinds, except the parenthesized keyword forms of rule H5, `fork(x)`, `join(x)`, and the await operations, which are syntax. Its syntax and the signature its callee resolves to decide which; nothing else does.

| Kind | Trigger | Meaning |
| --- | --- | --- |
| Run | The callee's declared return type is definitely an Effect, or the callee is a program value | Evaluate the callee and the arguments, run the returned program on this fiber, and take its success value |
| Plain | Every other call, and every `new` | JavaScript's call: the value is what the callee returns |
| Escape | The callee resolves to the prelude's `sync`, `try`, or `callback` | The first argument is TypeScript, run when the hatch runs (Chapter 10) |

**Rule R (run).**

- *Trigger.* A call whose callee resolves to a signature whose declared return type is **definitely an Effect**: the `Effect` interface, `Effect<A, E, R>` or `A!E!R`, with any type arguments, written directly or through a type alias whose body is one; a conditional type each of whose branches is definitely an Effect or `never`, such as the `All.Return<…>` that `Effect.all` declares; or a union each of whose members is definitely an Effect (D270). The signature is the one TypeScript resolves for the call. Its **declared return type** is the return type written in the declaration that signature comes from, or, where that declaration writes none, as an unannotated TypeScript function does, the one TypeScript infers for that declaration (D438), with every type parameter in scope there left uninstantiated: the signature's own, and those of every class, interface, function, method, and type alias that encloses it (D321, D378, D393). Also `p()`, where `p`'s type has no call signature and is definitely an Effect or extends `Effect`, or is a type parameter whose constraint is: calling a program value runs it (D437).
- *Not a trigger.* A type parameter, whatever instantiates it: the call's arguments, an explicit type argument, a receiver's type, or a type argument written in another declaration; `any`; `unknown`; an intersection; a union with any other member (`Effect<A> | undefined`); and any interface or class type that extends `Effect`, whether or not it adds members of its own: `Config` (`Config.ts:113`), `Exit` (`Exit.ts:89`), a service key (`Context.ts:68`), an error instance (`Cause.ts:1312`), or a program's own `interface Job extends Effect<number> {}` (D393). A call returning one of these returns it as data.
- *Static check.* The declared return type is read with every type parameter uninstantiated, so no instantiation, expected type, annotation on a receiving binding, or parameter the call fills changes whether a call runs (D321, D378, D393). The value of a call that runs has its success type A, and its E and R join the caller's contract (Chapter 14). A call that runs is EK1001 where its code runs as plain JavaScript: a module's top level, which no program runs; a class field initializer, a constructor, an accessor, or a static block, which JavaScript runs; and a parameter default, which is evaluated as plain code at the start of each run (E9) (D282). It is EK2003 under a plain contract and EK4301 in a plain callback.
- *Runtime.* Evaluate the callee and the arguments (rule E below), then run the program the call returns on the current fiber. The call's value is the program's success value. If the program fails, the failure propagates, and nothing to the right of the call is evaluated.
- *Returns.* `return e` returns `e`'s value: returning an Effect value never runs it, whatever the contract (D321, D379). Where the success type names no value, written or contextual, returning an Effect value or a program is EK4802, an error, since the caller would get it unrun; write `return p()` to run it. A success type names no value when it is `void`, `unknown`, or `any`, or an unconstrained type parameter that the declared return type of the function receiving the callback does not mention (D436): `acquireRelease` drops what a release returns, so a release that returns its program is EK4802, while `ids.map((id) => () => fetchUser(id))` keeps its programs, since `map` returns `U[]`.

```ts es
const user = Users.find(id)              // a service member returning User!UserNotFound: runs
const report = loadReport(id)            // a VibeLang function: runs
const row = findUser(id)                 // a TypeScript function returning an Effect: runs
const both = all([() => a(), () => b()]) // Effect.all's conditional return type: runs
const port = Config.Port("PORT")         // returns Config<number>: data
const done = Exit.succeed(1)             // returns Exit<number>: data
const same = identity(program)           // returns T: data, whatever T is
const held = new Box(program).get()      // Box<T>'s get returns T: data
const value = port()                     // calling a program value runs it
```

"Definitely" keeps the rule independent of inference. `identity` returns whatever it receives, and a TypeScript reader expects `identity(program)` to hand back the program, so a call of a generic callee whose declared return type is `T` returns data, whatever `T` becomes (D378); write `identity(program)()` to run it. The same holds for every type parameter in scope at the declaration, not only the signature's own: `Box<T>`'s `get(): T` returns data whatever the receiver's `T` is, so moving a function into a method never changes whether a call of it runs, and no instantiation does (D393). Write `new Box(program).get()()` to run the program; a statement that drops it is EK4801. Composing an Effect function with `flow` does not compile: `flow(parse, fetchUser)` passes `fetchUser` where `flow` expects a function returning its own type parameter, which takes the plain form, so it is EK4301; write `(raw) => fetchUser(parse(raw))` (D435). `Effect.all` returns an Effect for every argument it accepts, so every call of it runs. A `Config` stays data so that `Config.withDefault(Config.Port("PORT"), 3000)` composes before anything reads the variable, and a function that returns `new InvalidId({ raw })` returns the error instead of failing with it.

**Declarations keep the reading** [Rule] (D426). A declaration file can lose the declaration that rule R reads: for a `.ts` file's `export const composed = compose(parse, (n: number) => Effect.succeed(n))`, TypeScript writes `(a: string) => Effect<number>`, with `compose`'s type parameter gone, though a call of `composed` compiled against the source returns data, since `compose` declares its result's return type as its own type parameter. So where declaration emit writes a call signature from an inferred type, such as an exported `const` bound to a generic call's result, an extracted or bound method, a returned callback, or a property of an inferred object type, and the return type it writes is definitely an Effect while the declared return type that rule R reads in the source is not, it writes that return type as `AsData<T>`, the runtime's alias `type AsData<T> = T`. The alias's body is a type parameter, so rule R reads a call of the emitted signature as data, as a consumer of the source does, while stock TypeScript sees `T`. The compiler does this for the `.ts` files it compiles as well as for `.vibe` files. A declaration that stock TypeScript emitted has no such alias, and its written signature decides, as every foreign declaration's does (Chapter 26's trusted base).

**Rule P (plain).** *Trigger:* every call that is not of kind Run or Escape, and every `new C(…)`. *Static check:* the callee is a VibeLang function that compiles to plain JavaScript, or a trusted function; any other TypeScript or JavaScript function is EK4401, a platform API EK4402, and a clock or randomness read EK4403 (Chapter 10). *Runtime:* JavaScript's call. A plain call that returns an Effect value returns it as data: discarding it is EK4801, and returning it where the success type names no value is EK4802.

**Rule X (escape).** Chapter 10 defines the hatches.

| The callee is | Kind | Generated |
| --- | --- | --- |
| A VibeLang function with an Effect contract, inferred or written | Run | `yield* f(a)`, or its plain variant, `f$direct(a)` in its own file and `f[$direct](a)` from another, when it compiles to plain JavaScript (Chapter 15, D268) |
| A VibeLang function with a plain return annotation (D67) | Plain | `f(a)` |
| A TypeScript function whose declared return type is definitely an Effect | Run | `yield* f(a)` |
| A TypeScript function whose R contains a control operation | Rejected in v0: EK4202 (Chapter 9) | |
| A program value, `p()` | Run | `yield* p` |
| A service member, `Users.find(id)` | Lookup, then Run or Plain by the member's type | `yield* (yield* Users).find(id)`; `(yield* Path).join(a, b)` |
| A control operation, `Approval.approve(x)` | Lookup, then the nearest handler on this fiber | `yield* (yield* Approval).approve(x)` |
| A method of an Effect data type, `fiber.join()` | The module's function, then Run or Plain by its type | `yield* Fiber.join(fiber)`; `Stream.take(stream, 3)` |
| A JavaScript built-in, or an `effect` export that does not return an `Effect` | Plain, trusted: listed exceptions are expected failures in every function (D399) | `f(a)`, with listed exceptions converted |
| A TypeScript function wrapped with `trusted(impl, [Errors])` (D249, Chapter 10) | Run: the wrapper returns an `Effect`. In plain code, a plain trusted call of its implementation, whose listed exceptions are expected failures (D400) | `yield* f(a)`; `f[$direct](a)` in plain code |
| A TypeScript function with the deprecated `@vibelang trusted` tag (D23) | Plain, trusted, with warning EK4406 (D249) | `f(a)`, with listed exceptions converted |
| Any other plain TypeScript or JavaScript function | Rejected: EK4401 (Chapter 10) | |
| A platform API, or a clock or randomness read | Rejected: EK4402, EK4403 (Chapters 10, 11) | |
| `sync`, `try`, `callback` | Escape | Chapter 10 |
| `new C(…)` | Plain: constructs, never runs a program | `new C(…)` |

Because the kind of a call depends on its callee's declared signature, the compiler needs TypeScript's type checker, not a source transform, so VibeLang is a fork of the TypeScript compiler (Chapter 27). These rules define the language. An implementation that cannot apply them to a program rejects the program; it never gives the program another meaning.

#### Services, control operations, and data-type methods

Three call forms are shorthand for calls that rules R and P already cover. Each is recognized by the symbol its receiver resolves to (rule H).

- **Services.** Where `S` resolves to a service key, a `service` declaration, a `Context.Service` class, or a module whose name names its key (D311, D369), `S()` looks the implementation up in the current Context: a call that runs and adds `S` to R. `S.m(args)` is `S().m(args)`: the lookup, then the member, then the arguments, then the call, which runs when the member's declared type returns an Effect and is a trusted plain call otherwise. `S.v()`, where the member `v` is an Effect value, looks the service up and runs `v`. A value member read without a call is EK4503, a member named like a property of the key's own class included, such as `name` or `length`, which the key would otherwise answer with the class's own (D388).
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
| A block after a call, `f(args) { … }` (D188) | `() => { … }`, always `f`'s last argument (D376) |
| `fork e`, `fork(e)`, `fork { … }` (D166, D391) | `() => e`, run on a new fiber |
| Each element of an array or object literal after `await.all`, `await.allSettled`, `await.race`, or `await.any`, whatever its type (D196, D377) | `() => element`, each started on its own fiber |
| The left side of `x catch y` and `x catch (e) => …` (D236) | `x`, evaluated inside the catch |
| The block of `provide L { … }`, `uninterruptible { … }`, `restore { … }`, `interruptible { … }`, and a `for concurrent` body | The block |
| A hatch's first argument | TypeScript, run when the hatch runs (Chapter 10) |

*Static check:* the form's own; among them, an element of an await operation's literal operand, or a `fork` operand, whose type is a program is EK4613, since its result would be that program unrun (D394, D433). *Runtime:* evaluating the form evaluates nothing inside it. Each run evaluates the body from the start (rule E8).

A program passes to a TypeScript API in the representation the API declares. Where the declared type at the destination is the `Effect` interface, or a type parameter whose constraint includes it and no function type, a function with no required parameters, written there or passed as a value, is passed as an `Effect` that calls the function each time it runs (D7, D69, D381). The same holds for a declared variable, field, contextually typed object-literal field, or contextually typed array-literal element whose type is an Effect: `const tick: void!! = () => log("tick")` holds a program. The conversion changes the function's representation, never what runs or when: building the `Effect` runs nothing and reads nothing but the function value.

**Collections** [Rule] (D49, D111, D423). Only a literal converts element by element. Where a destination's element or field type converts functions to programs, an array literal written there converts each element after evaluating it, in order, and an object literal each field, as rule F converts any function at its destination. The elements a spread in such a literal supplies convert as the spread reads them, by the spread's static element type, never by a run-time test: a function type with no required parameters converts, and an element type that mixes one with other members does not, so TypeScript's type error names it. The spread reads its iterable or object as ECMAScript's spread does: once, at its place in the literal. Any other value, a variable, a call's result, a `Set`, or a record built elsewhere, is passed as the value it is, and nothing traverses it for the destination: where its elements or fields are functions and the destination expects Effects, the call is TypeScript's own type error, whose note and quick fix write the traversal as a spread, `all([...jobs])` or `all({ ...jobs })`. So no parameter type makes a call read a collection that its operands only name.

```ts es
function runAll(jobs: ReadonlyArray<() => number!!>) {
  return all([...jobs], { concurrency: 4 })   // the spread reads jobs here, once
}
```

```ts gen
// retry(() => syncInventory(store), Schedule.recurs(3))
yield* Effect.retry(Effect.gen(function* () { return yield* syncInventory(store) }), Schedule.recurs(3))
// retry(job, Schedule.recurs(3)), with const job = () => syncInventory(store)
yield* Effect.retry(Effect.suspend(job), Schedule.recurs(3))
```

**A call where a program is expected.** A call that runs, written where the declared type at its destination (see Function values, below), or an element or field type of it, is the `Effect` interface or a function with no required parameters that returns one, runs before anything receives it. Unless its success value is itself a program, an Effect or a function with no required parameters, that is EK1018, whose quick fix writes `() =>` before the call (D395): `retry(makeSync(store), policy)` passes the program `makeSync` returns and is accepted. It covers arguments, array elements, object-literal fields, and initializers of a `const` declared with an Effect type:

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

Most sites the earlier rules passed by name now fail to type-check, and EK1018 names them. A site whose old and new meanings both type-check would change silently: a call passed by name whose success value is itself an Effect, a held `const` or field of such a type, or a factory whose success type accepts the function it returns. A migration analyzer that knows the earlier rules reports each such site as EK1023, an error, and `--fix` rewrites it into the syntax that keeps its old meaning. A factory is TS2322 at its return, since a function is not its success type; `--fix` rewrites one that is not exported into a plain function that returns the program, and refuses an exported one with EK1023, never guessing its TypeScript API (D382, D390).

Earlier versions passed such calls by name, held typed initializers, made some functions factories, and ran some returned values; each of those sites now gets its behavior from syntax:

| Earlier form | Now | Where the behavior comes from |
| --- | --- | --- |
| `retry(fetchUser(id), policy)` | `retry(() => fetchUser(id), policy)` | A function literal (rule D) and its conversion |
| `fork(fetchReport())` | Unchanged, or `fork fetchReport()` | The `fork` keyword, with or without parentheses (rule H5, D391) |
| `Effect.all([a(), b()])` | `await.all [a(), b()]`, or `all([() => a(), () => b()])` | The await operation; function literals |
| `timeout(slow(), "1 second")` | `timeout(() => slow(), "1 second")` | A function literal |
| `fetchUser(id) \|> retry(%, policy)` | `retry(() => fetchUser(id), policy)` | The pipe's topic is a value (Chapter 5) |
| `pipe(() => fetchUser(id), retry(policy))`, a program by look-ahead (D110) | `retry(() => fetchUser(id), policy)` | A function literal; `pipe` passes its first argument as the value it is (D383) |
| `withSpan("load") { … }`, placed by the callee's type (D188) | `withSpan(() => { … }, "load")` | A function literal; a block is always the last argument (D376) |
| `race(do { … }, fetched())` | `race(() => { … }, () => fetched())` | Function literals |
| `const p: number!! = make()` | `const p = () => make()` | A function literal |
| `{ read: work() }`, where `read` is an Effect | `{ read: () => work() }` | A function literal and its conversion |
| `all(jobs)`, with `jobs` an array of functions, read into a new array at the call (D419) | `all([...jobs])` | A spread in an array literal, whose elements convert (D423) |
| A factory: `(input): number!! => { …; return () => snapshot }` | A plain function returning a program, or TypeScript (Chapter 5); `--fix` refuses an exported one with EK1023 | The returned function literal |
| `return exit` in an Effect function, run because an `Exit` does not fit A (S22-3) | `return exit()` | A call of a program value (D379) |
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

A function literal, or a named function used as a value, is always a function: nothing turns it into a call. Where it lands, it takes one of three forms. Its **plain form** is a JavaScript function: a call runs the body and returns its value. Its **Effect form** is a function that returns a cold program: a call runs none of the body, and each run of the program it returns runs the body afresh. A **program** is an `Effect` that calls the function on each run, for a function with no required parameters (D381). A VibeLang caller of either function form does the body's work at the call, since a call of the Effect form runs the program it returns (rule R); a TypeScript caller, or an API that receives the function, decides whether and when a program the Effect form returns runs. A function never becomes a program because its body can pause: `HttpRouter.add("GET", "/health", () => checkHealth())` passes a handler function, whatever `checkHealth` does, and the router calls it.

**Rule F (function forms)** [Rule] (D324, D392, D421, D422, D435).

- *Own form.* Every function has an own form, fixed by the function itself and never by the return type a destination expects: the form its return annotation names, plain for a plain annotation (D67) and Effect for an Effect contract, whatever its body does; without an annotation, plain when it is eligible for the plain form (Chapter 15: no Effect operation, and E is `never`) and Effect otherwise, as an `async` function's type includes its `Promise`. Eligibility reads the body with the function's parameter types: those it writes and, for a parameter it leaves unannotated, the type its destination's contextual signature gives, as TypeScript types a callback's parameters (D422). A named function, a function declaration or a `const` whose initializer is a function literal, has its declaration's own form; a method's follows its declaration (D397); any other function value, such as a property read, a parameter, or a call's result, has the form its type gives, plain for a plain function type and Effect for one that returns an Effect. The plain variant the compiler may give an Effect-contract function for its calls (Chapter 15) is an optimization of those calls, never a form: that function's own form stays Effect (D421).
- *Destinations.* The declared type at a destination is the parameter type of the signature the call resolves to, a declared variable, field, or return type, or the field type of a contextually typed object literal or the element type of a contextually typed array literal (D44, D423). The table says which forms each accepts. A destination that accepts the function's own form receives it. One that accepts only another form receives that one: a plain own form lifts to the Effect form, and a function with no required parameters, of either own form, converts to a program. An Effect own form never becomes the plain form: where only a plain function fits, a function whose own form is Effect is EK4301, an Effect-annotated function whose body could compile to plain JavaScript included (D421).
- *Overloads.* Overload resolution is TypeScript's, from the arguments' own types. A function literal with an unannotated parameter has an own form for each candidate, read with the parameter types that candidate's contextual signature gives (D422). The candidates are tried first with every function argument in its own form, accepted only where a destination accepts that form, and TypeScript's order, declaration order after its `reorderCandidates` step, picks among those that accept every argument (D56). That is the candidate TypeScript itself would pick, since a function returning `number` does not fit a parameter that returns `Effect<number>`. Only when no candidate accepts the arguments in their own forms are the candidates tried again with lifting and conversion, and then one that takes a function argument as a function is preferred to one that converts it to a program (D380). Where the candidates one step accepts give some function argument different forms, different own forms included, the call is EK1021, which asks for the form to be written: a return annotation or parameter annotations on the literal, or an explicit type argument. So the order of overloads never decides a function argument's form, nor whether its body runs when the API that receives it calls it.
- *Runtime.* The plain form is the JavaScript function; the Effect form, a function that returns an `Effect` that runs the body each time it runs; a program, an `Effect` that calls the function each time it runs.

A type parameter at a destination is read by one ordered rule (D435). One that another argument, the receiver, or an explicit type argument fixes, by TypeScript's inference, is read as its instantiation, as `push`'s element type is for `jobs.push(() => run())`. One that only the function itself fixes is read as not an Effect, since reading it would make the function decide its own form: as the return type of the destination's function type, as `Array.prototype.map`'s `U` is, the destination accepts the plain form; as the whole destination type, it accepts the function's own form. A constraint includes an Effect when it is definitely an Effect or a union with a member that is. A destination type's `null` and `undefined` members are ignored, as TypeScript ignores them when it finds a contextual signature, so an optional callback typed `((e) => boolean) | undefined` accepts what `(e) => boolean` accepts; "definitely an Effect" here is rule R's (D395).

| Declared type at the destination | Accepts |
| --- | --- |
| A function type whose return type is definitely an Effect, or a contract-less callback parameter of a VibeLang function (Chapter 16) | The Effect form |
| A function type returning any other type, `void`, `unknown`, `any`, and a type parameter included, as `Array.prototype.map` expects | The plain form. A function whose own form is Effect, because its body can pause, or let a `throw` or a listed failure escape, is EK4301 (D399) |
| A function type whose return type is a union of a definitely-Effect type and other types, `boolean \| Effect<boolean>` | Either function form: the function takes its own form (D112). The destination declares that it accepts both, and what it receives, a value or a program, is what the function is |
| `Effect<A, E, R>`, or a type parameter whose constraint includes an Effect and no function type, for a function with no required parameters | A program (rule D's conversion) |
| A type that includes both a function type and an Effect, as `HttpRouter.add`'s handler does | What its function member accepts; never a program |
| None, as for a function that another function returns, or a type that is none of the above, such as `any`, `unknown`, `object`, `Function`, or a type parameter that only the function fixes | Its own form |

```ts dts
// helpers.d.ts: a plain callback first, an Effect callback second
import { Effect } from "effect"

// The package is listed in vibelang.trustedPackages (Chapter 10).
export declare function register(f: (x: number) => number): string
export declare function register<E, R>(f: (x: number) => Effect.Effect<number, E, R>): Effect.Effect<string, E, R>
```

```ts es
const a = register((x) => Math.max(x, 0))                    // own form plain: overload 1, a plain call
const b = register((x) => Users.find(String(x)).id.length)   // own form Effect: overload 2, and the call runs
const c = register((x): number!! => Math.max(x, 0))          // the annotation names the Effect form: overload 2
```

`a`'s function is eligible for the plain form, so overload 1 takes it as it is, in either order of the overloads; TypeScript would pick the same overload. `b`'s function calls a service, so its own form is Effect: overload 1 does not accept it, and overload 2 does. The overload a call resolves to decides whether the call runs, as it decides whether a TypeScript call returns a `Promise`, and it is always the overload TypeScript would pick from the arguments' own types. Every argument other than a function is evaluated as a value, once, whatever the candidate.

**Function kinds** [Rule] (D421). One table gives each kind of function its own form, what a VibeLang call of it is, what TypeScript code receives, and what its declaration file records (Chapter 27, rule 3):

| Function | Own form | A VibeLang call | TypeScript code receives | Plain marker in its declaration | Where only a plain function fits |
| --- | --- | --- | --- | --- | --- |
| A function, function expression, arrow, or method with a plain return annotation, `(n: number): number` | Plain | Plain | The plain function | Yes; a method is named in its class's marker (D431) | It is passed |
| An unannotated one that is eligible (Chapter 15) | Plain | Run, through its plain variant | A function returning a cold `Effect`, carrying the plain variant as `f[$direct]` (D268) | Yes | Its plain variant is passed |
| An unannotated one that is not eligible | Effect | Run | A function returning a cold `Effect` | No | EK4301 |
| One with an Effect contract, `(n: number): number!!`, whatever its body | Effect | Run, through a plain variant where the compiler gives it one | A function returning a cold `Effect` | No | EK4301 |
| An unannotated protocol method, or one implementing a plain member (D397) | Plain, checked as a plain function | Plain | The plain method | Named in its class's marker (D431) | It is passed |
| Any other unannotated method | Effect | Run | A method returning a cold `Effect` | None | EK4301 |

A function stored where no type is declared, in a `const`, a `let`, an object-literal field with no contextual type, or a return with no declared type, keeps this representation: `export const double = (n: number) => n * 2` is a function returning a cold `Effect` to TypeScript, as Chapter 5 says, and its own form is plain, so `[1, 2].map(double)` passes its plain variant. The marker goes with a declaration wherever it is exported: under another name, through `export *`, as a default export, or through a `const` bound to it. An Effect-contract function performs, to its callers, the Effect operation its contract names, so calling one makes a caller ineligible for the plain form (Chapter 15). Producers are Chapter 8's.

#### Evaluation order and binding time

**Rule E.** Every expression is evaluated in JavaScript's order, each operand once, and a call that runs runs at its place in that order (D326). Precisely:

- **E1. Operands.** Operands are evaluated left to right, each exactly once, as ECMAScript evaluates them. A call evaluates its callee reference, receiver then member, before its arguments, and keeps the receiver as `this` (ECMAScript EvaluateCall, 13.3.6.1). A property read, a getter included, happens once per access written. An assignment evaluates its target reference before its right side; a compound assignment reads its target once and writes it once. A spread argument iterates once. A tagged template evaluates its tag reference, then its substitutions left to right, then calls the tag with the site's one template object (D267).
- **E2. Calls that run.** A call that runs runs after its callee and all its arguments are evaluated, and before anything to its right is evaluated. A pause inside it keeps every value already evaluated: no operand is evaluated again when the fiber resumes. If it fails, nothing to its right is evaluated, as after a `throw`.
- **E3. Service and control calls.** `S.m(args)` looks the service up, then reads the member, then evaluates the arguments, then calls, as `S().m(args)` does under E1. A missing service fails at the lookup, before any argument is evaluated.
- **E4. Short circuits.** In `a || b`, `a && b`, `a ?? b`, and `c ? x : y`, the left operand or the condition is evaluated first, a call that runs included, and its value, the success value and never a program, is tested. The right operand or the branch not chosen is not evaluated.
- **E5. Optional chains.** In `o?.m(args)`, `f?.(args)`, and `o?.[k]`, when the value before `?.` is `null` or `undefined`, the whole chain is `undefined` and nothing to its right is evaluated: no member read, no argument, no call. Otherwise the chain continues under E1 to E3, and `f?.(args)` runs when `f`'s declared return type is definitely an Effect (D68, D321).
- **E6. Pipes.** `x |> body` evaluates `x` once, before anything in the body, and `%` is its value; then the body is evaluated under E1. A name the body reads is read after `x` is evaluated, so the body sees what evaluating `x` changed. A function in the body that reads `%` keeps the value of the evaluation that created it (D325).
- **E7. Forms with operands.** A keyword form evaluates its own operands in the order written, before it starts any program. `for concurrent(n) (const x of xs)` evaluates `n`, then `xs`, then iterates `xs` once. `provide A, B { … }` evaluates `A`, then `B`. `wire(a(), b())` evaluates `a()`, then `b()`, then builds the layers in dependency order. `join e`, and an await operation whose operand is not an array or object literal, evaluate `e` once and read each element or own enumerable property once, in ECMAScript's order, and use that one reading both to wait and to interrupt; an await operation reads an iterable operand when it starts, on each run. An await operation whose operand is an array or object literal evaluates its computed keys and spread elements once, in source order, when it starts, and each element is a program (rule D, D377). Each element runs as a program on its own fiber, and its success value is its result (D394). A hatch evaluates its function, then its mapper, then its inputs (Chapter 10).
- **E8. Programs.** Evaluating a form of rule D evaluates nothing inside it. Each run of the program evaluates its body from the start under E1 to E7. Locals declared inside are fresh on each run. A binding captured from outside is read when the body reads it, so a run sees the binding's current value, not a copy taken when the program was built.
- **E9. Call time and run time.** For a VibeLang caller, call time and run time are one moment: a call that runs evaluates its arguments, then runs the callee's program at once. They are two moments for a TypeScript caller, which receives the program (Chapter 10), and for a program value run more than once. Bound once per call: the receiver and the argument values. Bound once per run: the parameters, from those argument values, with default values evaluated, destructuring and rest parameters performed, and a fresh `arguments` object; then the body runs.
- **E10. Coldness.** Building a program, by rule D or by calling a VibeLang function from TypeScript, runs none of its work: no statement of its body, no parameter default, no getter its body reads. Coldness does not promise sameness: each run does the work again, and work outside the language, such as a Promise already started that the program captured or a memoized `Effect.cached` value, keeps its own behavior. Fresh frames are not fresh resources.
- **E11. Equivalence.** Every compiled form of a program, optimized or not, produces the observations of the frame lowering in Chapter 26: the same success value; the same Exit, with the same reasons in the same order; the same calls, getter reads, and side effects, in the same order and number; the same bindings and lexical context; and the same resource and fiber lifetimes. This binds the plain path (Chapter 15), single-result bodies (D274), JavaScript's own `for...of` (D404), operand hoisting, pipe substitution, and every automatic fix that claims to keep a program's meaning (Chapter 28). An optimization that cannot establish this for a program is not applied to it.

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
- **H4. Recognition by symbol.** A rule that gives a name a special meaning applies only when the name resolves, through import aliases and re-exports, to the declaration the rule names. This covers runners (D38, D135), hatches (D148), `wire` (D27, D363), the prelude's functions, the built-in matchers such as `Option.Some` and `Number` (D208), the data-type method table (D152), a module's same-named export (D311), a function's trusted contract, and every exception list a diagnostic uses. A local declaration with the same spelling is an ordinary binding without that meaning; an alias of the declaration has all of it, except that the bindings of `fork`, `join`, and the hatches, whose first operand is deferred, cannot be renamed or stored (EK4410, D432).
- **H5. Keywords.** `fork e`, `join e`, `await.all`, `await.allSettled`, `await.race`, `await.any`, `provide L { }`, `x catch y`, `do { }`, `match`, `is`, `using`, `for concurrent`, and the mask blocks are syntax: no binding changes the forms written without parentheses. `fork` and `join` are contextual keywords, and only their parenthesized spelling follows a binding (D391): `fork(x)` and `join(x)` are the keyword with a parenthesized operand, deferred by syntax as `typeof(x)` is `typeof x`, unless `fork` or `join` resolves to a binding other than the prelude's own, declared or imported by the program, in which case the call is an ordinary call of that binding. The prelude's own `fork` and `join` are reached only through those spellings: an import that renames either, and any other reference to either, such as `const spawn = fork`, is EK4410, as a renamed or stored hatch is, so no call spelled otherwise defers its operand (D432). Which form `fork(x)` is follows the binding `fork` resolves to, never the spelling alone. The await operations take a parenthesized operand the same way, `await.all([a(), b()])`, and `await` cannot be a binding.
- **H6. Declarations.** Declaration files follow H1 and H2: an import that a `.d.ts` adds for a prelude type uses a fresh alias (D123), and no generated declaration collides with an export.
- **H7. Renaming.** Renaming a source binding consistently, to any name TypeScript allows there, never changes what a program does. The conformance suite renames the locals of its cases to the names the compiler generates and to the runtime's export names, and compares the results.

Hygienic macro expansion (Kohlbecker and others, 1986; R7RS 4.3), Racket's sets of scopes, and TypeScript's own `createUniqueName` are the prior art; ECMAScript's ResolveBinding is the standard that H4 follows.

#### Where programs start

A call never starts a fiber; a program starts only when a **runner** receives it. The compiler recognizes runners by their resolved symbols (rule H4): `Effect.runPromise`, `runPromiseExit`, `runSync`, `runSyncExit`, `runFork`, `runCallback`, and their `*With` forms; `ManagedRuntime`'s `run*` methods; `NodeRuntime.runMain` and `BunRuntime.runMain`; and `@effect/vitest`'s `it.effect`, `it.live`, their `.each` and `.prop` forms, and `layer(…)`.

A program's entry is an exported `main`; its file names its platform with an import, and the entry provides that platform's services (D135, D312):

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

A module that exports a function declaration named `main` with no parameters gets an entry statement, unless it already calls a runner at its top level (D135). The suppression test is rule H4's: a top-level call whose callee resolves to a runner's declaration, never a call that merely shares a runner's name, such as `helper.runSync(1)` on an object of the program's own. The entry statement uses `runtime.$entry` to start `main` only when the host starts this module, so importing it starts nothing; the helper checks the started file's exported `main` in bundles and CommonJS output, so an imported module's `main` does not start with the entry module's. The runner is `NodeRuntime.runMain` when `@effect/platform-node` resolves from the module, and the runtime's `$runMain` otherwise. A `main` that compiles to plain JavaScript runs through `Effect.sync`. An explicit top-level runner supplies its own layers and options and replaces the generated entry. Without a platform import, the entry provides no layer, and EK3205 names the services `main` needs that nothing provides. Whether a file gets an entry statement, what it provides, and whether EK3205 is reported depend on that file alone: no other file's imports enter any of the three (D387).

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
  To outlive refreshAll as a root would:   detach(() => refresh(id))
  To wait for every one:                   forEach(ids, (id) => refresh(id), { concurrency: "unbounded" })
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

A block on the same line after a call or a name is a program passed to that call (D188, the TC39 [block params](https://github.com/samuelgoto/proposal-block-params) proposal). It is always the last argument (D376): `f(args) { block }` is `f(args, () => { block })`, and `f { block }` is `f(() => { block })`. The block is a function body, so a value needs `return`. Its place never depends on the callee, and the written arguments are evaluated left to right before the call (E1):

```ts
function work(): string!! {
  sleep("1 millis")
  return "done"
}

it.effect("work finishes") {                 // it.effect("work finishes", () => { … })
  assert.strictEqual(work(), "done")
}
```

An Effect dual takes its program first, `withSpan(self, name)`, or returns a function that takes it, `withSpan(name)(self)`, and a curried combinator such as a semaphore's `withPermits(1)` returns such a function too, so a block after one of them, which goes last, fits no signature. That call fails with TypeScript's own type error, and a note names the parameter that takes the program and gives the spelling with an arrow in its place: `withSpan(() => { … }, "load")`, `semaphore.withPermits(1)(() => { … })`. A type decides only whether the call is rejected, never where the block goes; a migrated call whose appended form would still type-check is EK1023 (D382). Several combinators around one program nest arrows, or name each step:

```ts es
function loadUser(id: string) {
  const attempt = () => fetchUser(id)
  const retried = () => retry(attempt, { times: 3 })
  const bounded = () => timeout(retried, "2 seconds")
  return withSpan(bounded, "load-user")
}
```

`retry` runs `attempt` on each attempt, `timeout` bounds the retried work, and `withSpan` traces both.

A `{` on the line after a call or a name starts a block statement, as in JavaScript, not a block param. Where the statement before ends, with no `;`, in an identifier, a member access, or a call, as `return once` followed by `{ … }` on the next line, which would return the function and leave the block unreachable, the block is EK1022, a syntax error: join the lines to pass the block, or end the first line with `;` to keep a block statement.

A call with a block is a primary expression like any call: a member access, an element access, or another call may follow its closing brace (D273).

#### Precedence of VibeLang's forms

VibeLang's expression forms take these places in TypeScript's precedence, from the tightest [Rule]:

| Form | Binds | Decision |
| --- | --- | --- |
| `fork e`, `join e`, `await.all e`, `await.allSettled e`, `await.race e`, `await.any e` | As `await` binds its operand: `fork a().b` forks `a().b`. The operand starts on the keyword's line | D166, D196, D225 |
| `throw e` in an expression | Takes a unary expression, as in the proposal; a throw that is, or ends, a binary operator's left operand, a conditional's condition, or the operand of `as` or `satisfies` is EK1010 | D186 |
| `x is P` | At `instanceof`'s precedence | D211 |
| `x catch y`, `x catch (e) => h` | Looser than every binary operator, `??` and `\|\|` included; tighter than `? :`, assignment, arrow functions, and `\|>`; left-associative | D237 |
| `x \|> body` | Looser than every binary operator and `? :`, as an assignment is; left-associative; the body is a conditional expression | D154 |

A contract's `!` slots bind in types as Chapter 14's table says. Calls, `new`, member access, and every other operator keep TypeScript's precedence.

#### Where a type decides

A type rejects programs. In these places, and no others, a type also decides what a program does [Rule] (D413):

| Where | What the type decides | What it never decides |
| --- | --- | --- |
| Whether a call runs (rule R, D321, D393) | A call runs when the declared return type of the signature it resolves to is definitely an Effect, as a call of a Kotlin `suspend` function suspends. This is deliberate, and it is the only place a type makes a call run: changing a callee's declared return type from data, such as an `Exit`, a type parameter, or a union with a non-Effect member, to an Effect makes its calls run | When or how often the call's operands are evaluated |
| A function value's form (rule F, D324, D392, D421, D422) | Whether a function is passed in its plain form, its Effect form, or as a program, from the declared type at its destination; where the destination accepts both function forms, the function's own form (D112); and an unannotated parameter's type, from the destination's contextual signature, which the own form reads | When its body runs once something calls or runs it; which overload a call resolves to, which follows the arguments' own types as in TypeScript |
| A contract-less callback type (Chapter 16, D331, D398) | Whether a call of a parameter typed `(a: A) => B` runs: written in a `.vibe` file, the type is an Effect function type, and the call runs; declared in TypeScript, it is plain | Anything outside a parameter position, where a contract-less function type means what TypeScript means |
| A method's form (Chapter 10, D397) | Whether an unannotated method that implements a member of a declared interface or base class is plain: it is, where that member's type is plain | The form of any other method, which its annotation or its name decides |
| A function's plain return annotation (D67, D385) | Whether TypeScript callers receive a plain function or a function that returns a cold `Effect` | What a VibeLang caller observes |
| A method on an Effect data type (D152, D336) | Which module function `x.name(args)` calls, from the receiver's type, as an extension method | Evaluation order: the receiver first, then the arguments |
| An await operation's operand that is not a literal (Chapter 7, D394) | That each element is a program to run on its own fiber, from the operand's element type; any other element type is rejected | How often the operand is read: once per run of the operation |
| `using` (Chapter 6, D401, D425) | Whether `using` holds interruption off around an initializer that can pause, from whether the initializer's value type admits an object, which may carry a disposal method | Who releases the value, and how many times: the acquisition's run-time record and the value decide that, and the answer is once |
| `wire` (Chapter 4, D363) | The order in which its layers are built, from their Layer types | The order in which its arguments are evaluated: source order |

Every other rule reads syntax, resolved symbols, or run-time values. A program that a type would make mean something else is rejected instead. Optimizations are not on this list: rule E11 makes each one unobservable, so a type that lets the compiler choose a faster form decides nothing a program can see.
