## Part II. The rules

Part I showed the language by example. This part states its rules precisely, still from the programmer's side; Part III explains how the runtime carries them out.

### 13. What a call means

#### The principle

Calls work exactly as a TypeScript developer reading the code expects. Read every call of an effectful function as if it had an implicit `await`:

- A call does its work where it stands.
- Its callee and arguments are evaluated once, left to right, before the call, as in JavaScript, except an operand that syntax defers (rule D): `fork`'s, an await operation's literal elements, a hatch's first argument, and the right side of `x catch y`, which is evaluated only after `x` fails.
- Its value is what the callee returns. For an effectful callee, that is the success value; a failure propagates as a thrown error does. A call whose callee's declared return type is definitely an Effect runs where it stands, whatever its callee compiles to (D480).
- Delaying work means writing a function, `() => f(x)`, as in TypeScript.
- Whether a call runs is read from the declared return type of the signature the call resolves to, as a TypeScript reader reads `Promise` off a signature. Overload resolution picks that signature as TypeScript does, from the arguments' own types, except that it passes over a candidate where an Effect would stand for a plain function type, which TypeScript allows (rule F, D430, D453). Nothing the call itself instantiates, no annotation on the binding that receives the call's value, no type of a parameter the call fills, and no name spelling changes when, whether, or how often the call runs or its operands are evaluated. A function written as an argument is a value, and its body runs when its receiver calls it; TypeScript types its unannotated parameters from the contextual signature it gives the argument, which the overload TypeScript picks and, through inference, the call's own contextual type can decide, and the function's form and every call in its body follow that typing, as a callback's parameter types do in TypeScript: a rough edge, stated with its fix in rule F (D482, D494). A type may reject a program; in the places [Where a type decides](#where-a-type-decides) lists, and only there, it also decides what a program does, and each entry says what it decides and what it never decides.

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

Every call expression, `f(args)`, `o.m(args)`, `f?.(args)`, `o?.m(args)`, or a tagged template `` f`…` ``, is exactly one of three kinds, except the parenthesized keyword forms of rule H5, `fork(x)`, `join(x)`, and the await operations, which are syntax, and a hatch, whose first argument is TypeScript. Its syntax and the signature its callee resolves to decide which; nothing else does.

| Kind | Trigger | Meaning |
| --- | --- | --- |
| Run | The declared return type of the signature the call resolves to, which for a plain function is its plain signature (D445), is definitely an Effect, or the callee is a program value | Evaluate the callee and the arguments, run the returned program on this fiber, and take its success value |
| Plain | Every other call, a call of a plain function whose plain return type is not definitely an Effect included (D445, D480), and every `new` | JavaScript's call: the value is what the callee returns |
| Escape | The callee resolves to the prelude's `sync`, `try`, or `callback` | The first argument is TypeScript, run when the hatch runs (Chapter 10) |

**Rule R (run).**

- *Trigger.* A call whose callee resolves to a signature whose declared return type is **definitely an Effect**: the `Effect` interface, `Effect<A, E, R>` or `A!E!R`, with any type arguments, written directly or through a type alias whose body is one; a conditional type each of whose branches is definitely an Effect or `never`, such as the `All.Return<…>` that `Effect.all` declares; or a union each of whose members is definitely an Effect (D270). The signature is the one TypeScript resolves for the call. Its **declared return type** is the return type written in the declaration that signature comes from, or, where that declaration writes none, as an unannotated TypeScript function does, the one TypeScript infers for that declaration (D438); for a `.vibe` function that is its contract (Chapter 14), and a call of a plain function reads its plain signature instead (D445), so a call of a plain function whose plain return type is definitely an Effect runs the Effect it returns (D480). A type parameter in it is read by one rule, whatever construct declares it (D458), from the callee's type as TypeScript writes it, in a hover and in a declaration file alike (D491): one that the signature of the callee's type itself declares is left uninstantiated, whatever binds it, the arguments, an explicit type argument, or the call's contextual type (D378); and every other is read as TypeScript instantiates it for this call, as TypeScript shows the call's type, so one that TypeScript shows uninstantiated, as `T` in `this.get()` inside `class Box<T>`, is a type parameter there and is read as one (D486): a class's, an interface's, or a type alias's by the receiver's, the annotation's, or the alias's type arguments, and a function's or a call signature's by the completed call that returned the signature, such as the function `Effect.fn("load")(body, Effect.scoped)` or `compose(f, g)` gives, wherever that function is held (D449). An instantiation expression, `identity<X>`, is a value whose type TypeScript writes with `X` in place of `T` and no type parameter, `(x: X) => X`, so a call of it, `(identity<X>)(p)` or a call through any binding that holds it, reads that signature, while `identity<X>(p)`, a call with an explicit type argument, is a call of `identity`, whose signature declares `T` (D491). So the construct that declares a type parameter never changes whether a call runs: a type alias means what it names (D331), and a class's, an interface's, and an alias's type parameters are read alike, while a type that extends `Effect` is data whatever construct spells it (D393). A `const` bound to a call's result declares no signature of its own: its signature is the one the call returned, and an annotation on a binding that holds a function is that binding's declaration, so a call through `const load: (id: string) => Effect<User> = …` runs, as does one through `const load: Thunk<Effect<User>> = …` with `type Thunk<A> = () => A`. A callee whose type is a union of function types resolves to TypeScript's union signature, and the call runs when every member's declared return type, each read as above, is definitely an Effect (D454). A parameter of a `.vibe` function whose type is a contract-less function type, `f: (a: A) => B`, is read with the channels Chapter 16 adds, `(a: A) => B!E!R`, so a call of it runs (D398, D454). Also `p()`, where `p`'s type has no call signature and is definitely an Effect or extends `Effect`, or is a type parameter whose constraint is: calling a program value runs it (D437).
- *Not a trigger.* A type parameter that the reading above leaves uninstantiated: one the signature of the callee's type declares, however it is bound, and one that TypeScript shows uninstantiated for the call; `any`; `unknown`; an intersection; a union with any other member (`Effect<A> | undefined`); and any interface or class type that extends `Effect`, whether or not it adds members of its own: `Config` (`Config.ts:113`), `Exit` (`Exit.ts:89`), a service key (`Context.ts:68`), an error instance (`Cause.ts:1312`), or a program's own `interface Job extends Effect<number> {}` (D393); and a call of a plain function or of a `trusted` value whose plain call signature's return type is not definitely an Effect, which is a plain call (D445, D480). A call returning one of these returns it as data.
- *Static check.* The declared return type is read as above, so nothing the call instantiates, no expected type, no annotation on the binding that receives the call's value, and no parameter the call fills changes whether it runs (D321, D378, D449, D458). The value of a call that runs has its success type A, and its E and R join the caller's contract (Chapter 14). A call that runs is EK1001 where its code runs as plain JavaScript: a module's top level, which no program runs; a class field initializer, a constructor, an accessor, or a static block, which JavaScript runs; and a parameter default, which is evaluated as plain code at the start of each run (E9) (D282). It is EK2003 under a plain contract and EK4301 in a plain callback. A call of a plain function whose plain return type is not definitely an Effect is not a call that runs, so none of these applies to it (below, D445, D480).
- *Runtime.* Evaluate the callee and the arguments (rule E below), call it, through its plain form for a plain function (D445), and run the program the call returns on the current fiber. The call's value is the program's success value. If the program fails, the failure propagates, and nothing to the right of the call is evaluated.
- *Returns.* `return e` returns `e`'s value: returning an Effect value never runs it, whatever the contract (D321, D379). Where the success type names no value, written or contextual, returning an Effect value or a program is EK4802, an error, since the caller would get it unrun; write `return p()` to run it. So is returning a value whose type is definitely an Effect from a function whose own form is Effect, wherever the function stands, unless its return annotation writes the nested Effect, as Effect's language service reports such a `return` inside `Effect.gen` (`returnEffectInGen`): the function's callers would get the program unrun, while the same function without its Effect operation is a plain function, whose call runs the program it returns (D480), and which is passed unlifted where a callback returning a program is expected, whose receiver runs it (D453, D463). So the plain JavaScript a function compiles to never changes what its callers get. `flatMap(x, (v) => cached)` runs `cached`; `flatMap(x, (v) => { log("seen"); return cached })` is EK4802, repaired by `return cached()`, or by `(v): Effect<number>!! => …` where the nesting is meant. A returned function is a value, `return () => v`, and never EK4802 under the previous sentence, which is about a nested Effect; where the success type names no value, a function with no required parameters is still a program, and returning one is EK4802 under the first sentence, as Chapter 6's release `(lock) => releaseLater` is. A success type names no value when it is `void`, `unknown`, or `any`, or an unconstrained type parameter that the declared return type of the function receiving the callback does not mention (D436): `acquireRelease` drops what a release returns, so a release that returns its program is EK4802, while `ids.map((id) => () => fetchUser(id))` keeps its programs, since `map` returns `U[]`.

```ts es
const user = Users.find(id)              // a service member returning User!UserNotFound: runs
const report = loadReport(id)            // a VibeLang function: runs
const row = findUser(id)                 // a TypeScript function returning an Effect: runs
const scoped = load(id)                  // a function Effect.fn(…, Effect.scoped) returned: runs
const both = all([() => a(), () => b()]) // Effect.all's conditional return type: runs
const port = Config.Port("PORT")         // returns Config<number>: data
const done = Exit.succeed(1)             // returns Exit<number>: data
const same = identity(program)           // identity binds its own T: data, whatever T is
const held = new Box(program).get()      // get returns Box's T, here an Effect: runs
const kept = unbox(new Box(program))     // unbox<T>(b: Box<T>): T binds its own T: data
const value = port()                     // calling a program value runs it
```

**A call whose type is an Effect runs** [Rule] (D480). A call runs where the declared return type of its callee's resolved signature is definitely an Effect, whatever its callee compiles to. *Trigger:* rule R's: the declared return type of the signature the call resolves to is definitely an Effect, the plain call signature of a plain function included. *Static check:* rule R's: such a call is EK1001, EK2003, or EK4301 where its code runs as plain JavaScript, a call of a plain function included. *Runtime:* a plain function is called through its plain form, which runs its body and returns the program, and the program then runs on the current fiber, its success value the call's value; a call of the Effect form runs the program the call returns, and that program's success value is the call's value. The plain JavaScript a function compiles to never changes the value a call of it gives, since a function whose own form is Effect may not return a program as its success value unless its return annotation says so (*Returns*, EK4802):

```ts es
function pick(p: number!!) { return p }                   // compiles to plain JavaScript
// pick: Plain<(p: Effect<number>) => Effect<number>, (p: Effect<number>) => Effect<Effect<number>>>
function pickLogged(p: number!!) { log("pick"); return p() }   // an Effect function; `return p` is EK4802

const n = pick(load)                                      // runs load: n is a number
const m = pickLogged(load)                                // logs, then runs load: m is a number
const held: number!! = () => pick(load)                   // runs nothing: held is a program
const again = held()                                      // runs load
```

To hold a program unrun, write a function where an Effect type is declared: rule D's conversion makes the arrow the Effect, and each run of it calls the function, so `held` runs `load` each time it runs. An annotation on the receiving binding holds nothing: `const n: number!! = pick(load)` runs the call where it stands, so it is EK1018, whose quick fix writes the `() =>`. A TypeScript caller receives `pick`'s cold form, whose program, when run, gives `load` itself unrun, as its type `Effect<Effect<number>>` says; a VibeLang call runs both layers. Passing `pick` is not calling it: `xs.map(pick)` passes the plain form, which returns each program as data, while `xs.map((x) => pick(x))` is EK4301, since the literal's call of `pick` runs; write `forEach(xs, (x) => pick(x))` to run them (D480).

"Definitely" keeps the rule independent of what a call infers. `identity` returns whatever it receives, and a TypeScript reader expects `identity(program)` to hand back the program, so a call of a generic callee whose declared return type is its own type parameter `T` returns data, whatever this call binds `T` to (D378); write `identity(program)()` to run it. That is the one place instantiation is set aside: every other type parameter is read as TypeScript shows it for the call, whatever construct declares it (D458). So `new Box(program).get()` runs, since `get(): T` names `Box`'s `T`, which the receiver's type fixes, as `makeBox(program).get()` runs for `makeBox<T>(x: T): { get(): T }`; `Function.constant(program)()`, whose result Effect declares through its alias `LazyArg<A>`, runs as the same type written inline does; and `[a, b].reduce((acc, x) => acc, initial)` over Effects runs, since `reduce(f, initial: T): T` returns the array's own `T`. `unbox(new Box(program))`, a call of `unbox<T>(b: Box<T>): T`, returns data, since `unbox` binds its own `T`, and so does `[a, b].reduce<Effect<number>>((acc, x) => acc, initial)`, which selects `reduce`'s own `U`. A call hands back as data only what its own callee is generic in: read a container's Effect without running it through a property, `box.value`, or a function generic in it. Inside a generic declaration, TypeScript shows its own type parameters uninstantiated, so in `class Box<T>`'s own methods `this.get()` returns data, while `other.get()`, with `other: Box<Effect<number>>`, runs there as it runs anywhere, since TypeScript shows it `Effect<number>` (D486). An instantiation expression is a value of the type TypeScript writes for it, which declares no type parameter it bound: with `const idE = identity<Effect<number>>`, whose type is `(x: Effect<number>) => Effect<number>`, `idE(program)` runs the program, through a `let`, a field, or a declaration file alike, while `identity<Effect<number>>(program)` returns it (D491). A function that a completed call returned is read as that call bound it, as TypeScript shows it (D449): Effect's `Effect.fn("load")(body, Effect.scoped)` declares its result `(...args: Args) => A`, with `A` its own type parameter, which the call binds to the pipeline's `Effect`, so a call of `load` runs, wherever `load` is held. Composing an Effect function with `flow` does not compile: `flow(parse, fetchUser)` passes `fetchUser` where `flow` expects a function returning its own type parameter, which takes the plain form, so it is EK4301; write `(raw) => fetchUser(parse(raw))` (D435). `Effect.all` returns an Effect for every argument it accepts, so every call of it runs. A `Config` stays data so that `Config.withDefault(Config.Port("PORT"), 3000)` composes before anything reads the variable, and a function that returns `new InvalidId({ raw })` returns the error instead of failing with it.

**Calls of plain functions** [Rule] (D445). A call of a plain function, one whose own form is plain (rule F), is a call of its plain form, wherever it stands; so is a call of a `trusted` value. It is a plain call unless the plain form's declared return type is definitely an Effect, when the call runs the Effect the plain form returns (D480).

- *Trigger.* A call whose callee's type carries a plain form: the runtime's `Plain<F, C>`, which every function whose own form is plain has wherever it is held with no declared type (below, D483), a function with a plain return annotation, an eligible unannotated function, and an object literal's method or function-literal field whose own form is plain alike, from source and from declarations; or `Trusted<F, Errors>`, whose plain form classifies the exceptions it lists (D400, D431); or a call of a class's method whose own form is plain (D397, D430), which a declaration file names in its class's marker (Chapter 27). A union callee is one when each of its members is plain: a `Plain<F, C>` or `Trusted<F, Errors>` member read as `F`, and a trusted plain function type, such as a JavaScript built-in's, read as itself; the call reads `[$direct]` where the value has it, then the plain form the program a call of the value returns records, and otherwise takes what that call returned, which only a member of the second kind gives, so `(asc ? double : Math.abs)(-2)` is a plain call (D495). A function with an Effect contract is not a plain function, whatever its body (D421).
- *Kind.* The call resolves to the function's plain call signature, `F`, the one its type records, never to the Effect signature TypeScript code sees, and `F`'s return type is the declared return type rule R reads. Where it is not definitely an Effect, the call is Plain, and its value is what the body returns; where it is, as for `pick` above, the call is Run: it calls the plain form and runs the program the body returns, and its value is that program's success value (D480). An eligible callee's E and R are `never`; a `trusted` value's listed failures are expected failures (D399).
- *Static check.* Rule P's, so the call is legal in plain code, the places where code runs as plain JavaScript, as it is in an Effect function: at a module's top level, in a class field initializer, a constructor, an accessor, a static block, or a parameter default, in a function with a plain contract, and in a plain callback. A call whose plain return type is definitely an Effect runs a program, so it is rule R's EK1001, EK2003, or EK4301 in those places (D480). A caller whose calls are all plain stays eligible itself (Chapter 15). A `trusted` value's listed failure that can escape is EK2003 under a plain annotation, EK4301 in a plain callback, EK1001 at a module's top level, in a class field initializer, or in a parameter default, and EK2003 in a constructor, an accessor, or a static block (D455). The kind follows the callee's own form, never an optimization: a call of a function with an Effect contract is a call that runs, EK1001, EK2003, or EK4301 in those places, even where the compiler gives that function a plain variant; and an eligible function's plain form is part of the function, which every compilation emits, one that lowers every other function to frames included, so no compiler setting changes which programs compile.
- *Runtime.* JavaScript's call of the plain form: it binds the parameters, runs the body once, synchronously, and returns its value, which the call then runs on the current fiber where the plain return type is definitely an Effect (D480). The plain call itself starts no fiber, calls no runner, and builds no program. A plain function, or a `trusted` value's implementation, performs no Effect operation, needs no service, and fails only as its contract lists, so running the program its Effect form returns, and then the program that gives where the plain return type is an Effect, gives the same observations (rule E11), and in Effect code the compiler may run those instead. An exception that no contract lists is a defect: it propagates as the exception it is through plain code, and becomes `Die` where it reaches an Effect function. Before the exporting module's body has run, as in a module cycle, the call reaches the plain form through the hoisted function (Chapter 26, D446).

```ts es
// helpers.vibe
export function double(n: number) {           // eligible: a plain function
  return n * 2
}

export function twice(n: number): number!! {  // an Effect contract: not a plain function
  return n * 2
}
```

```ts es
// consumer.vibe
import { double, twice } from "./helpers.js"

export function plain(n: number): number {
  return double(n)                            // twice(n) here: EK2003
}

export function mapped() {
  return [1, 2].map((n) => double(n))         // [2, 4]; twice(n) here: EK4301
}

export const initial = double(3)              // 6; twice(3) here: EK1001
```

`plain(3)` is 6. Compiled against `helpers.d.ts` instead of the source, `consumer.vibe` compiles and gives the same values, since `double`'s declared type, `Plain<(n: number) => number, (n: number) => Effect<number>>`, carries its plain form and `twice`'s does not (Chapter 27, D483). In an Effect function a call of `twice` runs, and may cost what a call of `double` costs, through the plain variant the compiler gives it, but its contract says it is an Effect, and a caller sees the contract, not the body (D421).

**Declarations keep the reading** [Rule] (D458, D491). Rules R and F read a callee's or a function value's type as TypeScript writes it, in a hover and in a declaration file: its signatures, the type parameters each signature declares, and every other type parameter instantiated as the type shows it. Nothing they read is a fact that TypeScript's checker keeps and declaration emit drops, such as the generic declaration an instantiation expression or an extracted method came from. Declaration emit writes that type: an exported `const` bound to an extracted or bound method, an instantiation expression, a returned callback, or a property of an inferred object type is written with the instantiated type TypeScript infers, and a generic signature keeps its own type parameters. So a call compiled against a declaration file reads what a call compiled against the source reads, for the `.ts` files the compiler compiles as for `.vibe` files, and for a declaration stock TypeScript emitted too: `export const read = new Box(Effect.succeed(1)).get`, `export const idE = identity<Effect.Effect<number>>`, and `export const composed = compose(parse, (n: number) => Effect.succeed(n))` in a `.ts` file run from their source and from their declarations alike (D449), and `read` and `idE` are Effect-form values to both, so passing either where only a plain function fits is EK4301 to both (D492). Chapter 14's check reads a member of an object type by the member's declaration, which a declaration file keeps with the type (D485, D492). Declaration emit writes no alias for this, and the runtime no longer exports the `AsData<T>` that D426 had it write.

**Rule P (plain).** *Trigger:* every call that is not of kind Run or Escape, and every `new C(…)`. *Static check:* the callee is a VibeLang function that compiles to plain JavaScript, or a trusted function; any other TypeScript or JavaScript function is EK4401, a platform API EK4402, and a clock or randomness read EK4403 (Chapter 10). *Runtime:* JavaScript's call. A plain call that returns an Effect value returns it as data: discarding it is EK4801, and returning it where the success type names no value is EK4802.

**Rule X (escape).** Chapter 10 defines the hatches.

| The callee is | Kind | Generated |
| --- | --- | --- |
| An unannotated VibeLang function that is eligible for the plain form, a plain function (Chapter 15), or any value whose type is `Plain<F, C>` (D483) | Plain, through its plain form, in plain code too (D445); Run where its plain return type is definitely an Effect: the plain call, then a run of the program it returns (D480) | `f$direct(a)` in its own file and `$plainOf(f)(a)` from another or through a value, which reads `f[$direct]` once its module has attached it (D268, D446); a method keeps its receiver, `$plainOf(o.m).call(o, a)` (E1, L1); `yield* f$direct(a)` where it runs (D480) |
| Any other VibeLang function with an Effect contract, inferred or written | Run | `yield* f(a)`, or its plain variant, `f$direct(a)` or `f[$direct](a)`, where the compiler gives it one (Chapter 15, D421) |
| A VibeLang function with a plain return annotation (D67) | Plain; Run where its return type is definitely an Effect, the call and then a run of the Effect it returns (D480) | `f(a)`; `yield* f(a)` where it runs |
| A TypeScript function whose declared return type is definitely an Effect | Run | `yield* f(a)` |
| A TypeScript function whose R contains a control operation | Rejected in v0: EK4202 (Chapter 9) | |
| A program value, `p()` | Run | `yield* p` |
| A contract-less callback parameter of a VibeLang function, `f(item)` in Chapter 16's `mapAll` | Run (D398, D454) | `yield* f(item)` |
| A service member, `Users.find(id)` | Lookup, then Run or Plain by the member's type | `yield* (yield* Users).find(id)`; `(yield* Path).join(a, b)` |
| A control operation, `Approval.approve(x)` | Lookup, then the nearest handler on this fiber | `yield* (yield* Approval).approve(x)` |
| A method of an Effect data type, `fiber.join()` | The module's function, then Run or Plain by its type | `yield* Fiber.join(fiber)`; `Stream.take(stream, 3)` |
| A JavaScript built-in, or an `effect` export that does not return an `Effect` | Plain, trusted: listed exceptions are expected failures in every function (D399) | `f(a)`, with listed exceptions converted |
| A TypeScript function wrapped with `trusted(impl, [Errors])` (D249, Chapter 10) | Plain, through its plain form, in plain code too, whose listed exceptions are expected failures (D400, D445); in Effect code, running the wrapper's `Effect` instead is an optimization rule E11 governs | `f[$direct](a)`; `yield* f(a)` where Effect code takes the optimization |
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
| `fork e`, `fork(e)`, `fork { … }` (D166, D391, D452) | `() => e`, run on a new fiber |
| Each element of an array or object literal written as the operand of `await.all`, `await.allSettled`, `await.race`, or `await.any`, parenthesized or not, whatever its type (D196, D377, D462) | `() => element`, each started on its own fiber |
| The left side of `x catch y` and `x catch (e) => …` (D236) | `x`, evaluated inside the catch |
| The block of `provide L { … }`, `uninterruptible { … }`, `restore { … }`, `interruptible { … }`, and a `for concurrent` body | The block |
| A hatch's first argument | TypeScript, run when the hatch runs (Chapter 10) |

*Static check:* the form's own; among them, an element of an await operation's literal operand, or a `fork` operand, whose type is a program is EK4613, since its result would be that program unrun (D394, D433). *Runtime:* evaluating the form evaluates nothing inside it. Each run evaluates the body from the start (rule E8).

A program passes to a TypeScript API in the representation the API declares. Where the declared type at the destination is the `Effect` interface, or a type parameter whose constraint includes it and no function type, a function with no required parameters, written there or passed as a value, is passed as an `Effect` that calls the function each time it runs (D7, D69, D381). The same holds for a declared variable, field, contextually typed object-literal field, or contextually typed array-literal element whose type is an Effect: `const tick: void!! = () => log("tick")` holds a program. Conversion itself runs none of the function's body: building the `Effect` runs nothing and reads nothing but the function value, and each run of the program calls the function.

**Collections** [Rule] (D49, D111, D423). Only a literal converts element by element. Where a destination's element or field type converts functions to programs, an array literal written there converts each element after evaluating it, in order, and an object literal each field, as rule F converts any function at its destination. The elements a spread in such a literal supplies convert as the spread reads them, by their static types, never by a run-time test: a tuple's element by its position's type, an object's property by its own type, and an array's or iterable's elements by its element type (D453). A function type with no required parameters converts, and an element type that mixes one with other members does not, so TypeScript's type error names it. The spread reads its iterable or object as ECMAScript's spread does: once, at its place in the literal. Any other value, a variable, a call's result, a `Set`, or a record built elsewhere, is passed as the value it is, and nothing traverses it for the destination: where its elements or fields are functions and the destination expects Effects, the call is TypeScript's own type error, whose note and quick fix write the traversal as a spread, `all([...jobs])` or `all({ ...jobs })`. So no parameter type makes a call read a collection that its operands only name.

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

**A call where a program is expected.** A call that runs, written where the declared type at its destination (see Function values, below), or an element or field type of it, is the `Effect` interface or a function with no required parameters that returns one, runs before anything receives it. Unless its success value is itself a program, an Effect or a function with no required parameters, that is EK1018, whose quick fix writes `() =>` before the call (D395): `retry(makeSync(store), policy)` passes the program `makeSync` returns and is accepted. It covers arguments, array elements, object-literal fields, and initializers of a `const`, a `let`, or a field declared with an Effect type:

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

- *Own form.* Every function has an own form, fixed by the function itself and never by the return type a destination expects: the form its return annotation names, plain for a plain annotation (D67) and Effect for an Effect contract, whatever its body does; without an annotation, plain when it is eligible for the plain form (Chapter 15: no Effect operation, and E is `never`) and Effect otherwise, as an `async` function's type includes its `Promise`. Eligibility reads the body with the function's parameter types: those it writes and, for a parameter it leaves unannotated, the type TypeScript assigns it from its destination's contextual signature, once, as TypeScript types a callback's parameters, whatever fixes that signature: the overload TypeScript picks, the other arguments, the receiver, an explicit type argument, or, through TypeScript's inference, the call's own contextual type (D422, D450, D494). A function whose own form is plain carries it in its type wherever it is held with no declared type, the runtime's `Plain<F, C>` (below, D483), so a function value's form is its type's, whoever holds it: one whose type is `Plain<F, C>` or `Trusted<F, Errors>` is plain, through a `const`, a `let`, a field, an element, a parameter, a call's result, or an import alike; any other has the form its type gives, as TypeScript writes that type, read as rule R reads a call of it: plain where such a call would be plain, as for a plain function type or a return type rule R reads as data, and Effect where it would run (D448, D492). So `new Box(program).get`, whose type TypeScript writes `() => Effect<number>`, is an Effect-form value wherever it is held, as a call of it runs; Chapter 14's check, which compares an object's type, reads a member by its declaration instead (D485). A class's method follows its declaration (D397); an object literal's method is a function at its field's destination, so its own form is read as a function literal's is (D430, D448). The plain variant the compiler may give an Effect-contract function for its calls (Chapter 15) is an optimization of those calls, never a form: that function's own form stays Effect (D421).
- *Destinations.* The declared type at a destination is the parameter type of the signature the call resolves to, a declared variable, field, or return type, or the field type of a contextually typed object literal or the element type of a contextually typed array literal (D44, D423). A field of an object literal at a protocol key is a destination that accepts only the plain form, whatever the literal's contextual type, since JavaScript calls it by its key (Chapter 10, D484). A field whose contextual member a class, an interface, or a type alias declares reads that declaration, with its declaring type's own type parameters left uninstantiated, as Chapter 14's check reads it: under `Source<number!!>`, with `interface Source<T> { get(): T }`, a literal's `get` is at a destination that returns a type parameter and accepts the plain form (D492). A destination reaches an expression inside parentheses, a conditional's arms, both operands of `??` and `||`, the right operand of `&&` and of a comma, and the operand of `satisfies`, as TypeScript's contextual typing does, never the operand of `as`, which asserts a type and converts nothing (D453, D461, D488). So `retry(job ?? (() => a()), policy)` converts the operand whose value it takes to a program, and `cond && (() => a())` converts only its right operand, as TypeScript types only that one by the destination. The table says which forms each accepts. A destination that accepts the function's own form receives it. One that accepts only another form receives that one: a plain own form lifts to the Effect form, and a function with no required parameters, of either own form, converts to a program. An Effect own form never becomes the plain form: where only a plain function fits, a function whose own form is Effect is EK4301, an Effect-annotated function whose body could compile to plain JavaScript included (D421).
- *Overloads* [Rule] (D482). An overloaded call resolves as TypeScript resolves it: TypeScript tries the candidates in declaration order, after its `reorderCandidates` step, by its subtype relation and then by assignability, and the first that accepts the call is the signature the call resolves to. TypeScript types a function literal argument once, with the contextual type that the first candidate it checks the literal against gives it, and keeps that typing for every later candidate (D450); the literal's unannotated parameters and its return positions take that typing, and so do its own form and every call in its body, and VibeLang compares no other candidate's typing. Each function argument is tried first in its own form, accepted only where a destination accepts that form and where Chapter 14's check that an Effect never satisfies a plain function type passes (D430, D453), so the candidate picked is the one TypeScript picks with each function argument typed by its own form, `F` for a value of type `Plain<F, C>`, less the candidates D430 excludes, since a function returning `number` does not fit a parameter that returns `Effect<number>` (D56, D392). Stock TypeScript types such a value by `C`, so for `register(double)`, with the two overloads of the listing below, a TypeScript consumer of `double` picks the Effect overload and VibeLang the plain one, which takes `double`'s own form (D494). Only when no candidate accepts the arguments in their own forms, where TypeScript would report that no overload matches, are the candidates tried again with lifting and conversion; then a candidate that takes a function argument as a function ranks above one that converts it to a program, and the two are no tie (D380). EK1021 is reported only there, where TypeScript has no answer: when the candidates that step accepts give a function argument different function forms, plain and Effect, or two function arguments prefer different candidates. Its quick fix writes the form: a return annotation or parameter annotations on the literal, or an explicit type argument. So `Effect.tap(self, (a) => …)`, `Effect.catchIf(load, isNotFound, (e) => …)`, and `rows.reduce((acc, x) => [...acc, ...x], [])` type their literals as TypeScript does, and none is EK1021.
- *Rough edge* (D482, D494). A function literal's typing is TypeScript's, so what decides a callback's parameter types in TypeScript decides here the calls in its body and its own form. Besides the literal's own annotations, two things decide that typing: the order of a library's overloads, since TypeScript types the literal by the first candidate it checks it against and keeps that typing, and the call's own contextual type, such as an annotation on the binding that receives the call, from which TypeScript infers a type parameter that the literal's parameter type names. Either can turn a call in the body from plain into one that runs, and with it the literal's own form from plain to Effect. At a destination that accepts only the plain form, the Effect form is then EK4301, and at one whose return type is definitely an Effect, the plain form lifts, so in both the difference stays inside the body, where each call follows the type TypeScript gives its callee. At a destination that accepts both forms, a function type whose return type is a union of an Effect and another type (D112), the difference reaches the receiver: its call of the literal runs the body under one typing and, under the other, builds a program that the receiver may never run. With `consume(f: (run: () => number) => number | Effect<number>)` declared before `consume(f: (run: () => Effect<number>) => number | Effect<number>)`, `consume((run) => { run(); events.push(1); return 0 })` types `run` as `() => number`, the callback's own form is plain, and `consume`'s call of it pushes once; with the two overloads in the other order, `run` is `() => Effect<number>`, `run()` runs, the callback's own form is Effect, and `consume`'s call of it builds a program that `consume` never runs, so nothing is pushed. With `keep<T>(cb: (x: T) => number | Effect<number>): (x: T) => number | Effect<number>`, which returns its argument, `const f: (x: Data) => number | Effect<number> = keep((x) => { x.run(); events.push(1); return 0 })` types `x` as `Data`, whose `run()` returns data, and the same line written with `Job`, whose `run()` returns an Effect, types `x` as `Job`, with the same two outcomes for a TypeScript caller of `f`. A named function or a generic call at the callback's return position takes its typing from the same contextual signature, so it can differ the same way. Write the form to fix it: a return annotation on the callback, `(run): number!! => …`, gives it one own form whatever types it, and an annotation on a parameter, `(run: () => number) => …` or `(x: Data) => …`, or an explicit type argument, `keep<Data>(…)`, gives its body one typing. Prior art: TypeScript's overload resolution, which picks the first matching overload in declaration order and types a callback once from it, and whose handbook asks libraries to declare the most specific overloads first; and TypeScript's inference from a call's contextual type, which types `a` in `pipe(load, Effect.map((a) => a + 1))` from `pipe`.
- *Runtime.* The plain form is the JavaScript function; the Effect form, a function that returns an `Effect` that runs the body each time it runs; a program, an `Effect` that calls the function each time it runs.

A type parameter at a destination is read by one ordered rule (D435). One whose instantiation TypeScript infers from another argument, the receiver, an explicit type argument, or the call's contextual type, such as an annotation on the binding that receives the call, is read as that instantiation, as `push`'s element type is for `jobs.push(() => run())`, and as TypeScript types the function's parameters from it (D494). One whose only source is the function itself is read as not an Effect, since reading it would make the function decide its own form: as the return type of the destination's function type, as `Array.prototype.map`'s `U` is, the destination accepts the plain form; as the whole destination type, it accepts the function's own form. This rule reads a type parameter only where it is a function value's whole destination or a destination function type's return type; the element and field types of a literal argument are the contextual types TypeScript derives, through the constraint of a type parameter the call has not fixed, as `Effect.all`'s `Arg extends Iterable<Effect<any, any, any>> | Record<string, Effect<any, any, any>>` gives each element of `all([() => a(), () => b()])` an Effect type (D453). A constraint includes an Effect when it is definitely an Effect or a union with a member that is. A destination type's `null` and `undefined` members are ignored, as TypeScript ignores them when it finds a contextual signature, so an optional callback typed `((e) => boolean) | undefined` accepts what `(e) => boolean` accepts; "definitely an Effect" here is rule R's (D395).

| Declared type at the destination | Accepts |
| --- | --- |
| A function type whose return type is definitely an Effect, or a contract-less callback parameter of a VibeLang function (Chapter 16) | The Effect form; and, unlifted, a function whose own form is plain and whose plain return type is itself definitely an Effect, since a call of it already returns the program the destination expects: `(acc, x) => acc` in `reduce` over Effects, or `(v) => cached` at `flatMap` (D453) |
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

The form a function is passed in is observable to the code that calls it. A trusted TypeScript API declared `once(f: () => number | Effect<number>): void`, which calls `f` once and drops the result, receives `() => { count++; return count }` in its plain form, since the destination accepts both and the function's own form is plain, and the call adds one to `count`; written `(): number!! => { count++; return count }`, the same function is received in its Effect form, the call builds a program that `once` never runs, and `count` is unchanged. Each is what the destination declares it accepts, and the function's own form decides which (D112, D447).

`a`'s function is eligible for the plain form, so overload 1 takes it as it is, in either order of the overloads; TypeScript would pick the same overload. `b`'s function calls a service, so its own form is Effect: overload 1 does not accept it, and overload 2 does. The overload a call resolves to decides whether the call runs, as it decides whether a TypeScript call returns a `Promise`, and it is always the overload TypeScript would pick from the arguments' own types, each function argument typed by its own form. Every argument other than a function is evaluated as a value, once, whatever the candidate.

**Function kinds** [Rule] (D421). One table gives each kind of function its own form, what a VibeLang call of it is, whether plain code may call it, what TypeScript code receives, and what its declaration file records (Chapter 27, rule 3). **Plain code** is code that runs as plain JavaScript: a module's top level, a class field initializer, a constructor, an accessor, a static block, a parameter default, a function with a plain contract, and a plain callback (rule R).

In the two call columns, "Plain" and "Called" hold where the function's plain return type is not definitely an Effect; where it is, a VibeLang call is Run, through the plain form, and in plain code it is EK1001, EK2003, or EK4301, as rule R says (D480).

| Function | Own form | A VibeLang call | In plain code | TypeScript code receives | Its type where no type is declared, or its marker | Where only a plain function fits |
| --- | --- | --- | --- | --- | --- | --- |
| A function, function expression, arrow, or method with a plain return annotation, `(n: number): number` | Plain | Plain | Called | The plain function | `Plain<F>`; a class's method is named in its class's marker instead (D431, D483) | It is passed |
| An unannotated one that is eligible (Chapter 15) | Plain | Plain, through its plain form (D445) | Called | A function returning a cold `Effect`, carrying its plain form as `f[$direct]` (D268) | `Plain<F, C>`, `C` the cold signature (D483) | Its plain form is passed |
| An unannotated one that is not eligible | Effect | Run | EK1001, EK2003, or EK4301 | A function returning a cold `Effect` | Its cold signature, with no plain form | EK4301 |
| One with an Effect contract, `(n: number): number!!`, whatever its body | Effect | Run, through a plain variant where the compiler gives it one | EK1001, EK2003, or EK4301, plain variant or not (D421) | A function returning a cold `Effect` | Its cold signature, with no plain form | EK4301 |
| An unannotated protocol method, or one implementing a plain member (D397) | Plain, checked as a plain function | Plain | Called | The plain method | Named in its class's marker (D431) | It is passed |
| Any other unannotated method of a class | Effect | Run | EK1001, EK2003, or EK4301 | A method returning a cold `Effect` | None | EK4301 |
| An object literal's method, or a function literal or any other function value written as its field, at a protocol key (Chapter 10, D484) | Plain, checked as a plain function | Plain | Called | The plain function | `Plain<F>` (D483) | It is passed |
| An object literal's unannotated method, or a function literal written as its field, at any other key | As a function literal's: plain where eligible, Effect otherwise (D448) | Plain, through its plain form, where eligible (D445); Run otherwise | Called where eligible; otherwise EK1001, EK2003, or EK4301 | A method returning a cold `Effect`, carrying its plain form as `m[$direct]` where eligible (D460) | `Plain<F, C>` where eligible, its cold signature otherwise (D483) | Its plain form is passed where eligible; EK4301 otherwise |
| A class field whose initializer is a function literal, `double = (n: number) => n * 2` | As a function literal's (D448) | Plain, through its plain form, where eligible (D445); Run otherwise | Called where eligible; otherwise EK1001, EK2003, or EK4301 | A function returning a cold `Effect`, carrying its plain form as `f[$direct]` where eligible | `Plain<F, C>` on the property where eligible, its cold signature otherwise (D483) | Its plain form is passed where eligible; EK4301 otherwise |

A function stored where no type is declared, in a `const`, a `let`, an object-literal field with no contextual type, or a return with no declared type, keeps at run time the representation TypeScript code receives: `export const double = (n: number) => n * 2` is a function returning a cold `Effect` to TypeScript, as Chapter 5 says, and carries its plain form as `double[$direct]`. So an object or an array that holds such a function holds that representation, and nothing converts what it holds: Chapter 14's check reads it there by the cold form, and passing the object or array where TypeScript would call the function as plain is EK4301, while a literal written at that destination converts (D493).

**The plain form is part of the type** [Rule] (D483). *Trigger:* a function whose own form is plain, held where no type is declared. *Static check:* its type is the runtime's `Plain<F, C>`, where `F` is its plain call signature and `C` what TypeScript code calls: `F` itself for a function with a plain return annotation or a protocol member (Chapter 10, D484), and the cold signature, `(n: number) => Effect<number>`, for an eligible unannotated function (D385). The type goes wherever the value goes, as TypeScript's types do, so `const twin = double`, `let g = double`, `{ double }`, a method of a returned object, an element, and an import, through any alias, re-export, namespace import, or default export, all have `double`'s plain form: a call of any of them is a plain call, and passing any of them where a plain function is expected passes the plain form, from source and from declarations alike; an existing object or array that holds one passes what it holds, the cold form, and is checked as that (Chapter 14, D493). A declared type replaces it, as it replaces any value's: `const f: (n: number) => Effect<number> = double` holds the Effect form (rule F), whose call runs, and `const p: (n: number) => number = double` holds the plain function. `Plain<F, C>` written as a declared type, `const h: typeof double = (n) => n * 3`, is met only by a value of that type, since the run time supplies its `[$direct]` member to a function the compiler compiled, so a function literal there is TypeScript's TS2322; declare the plain signature, `const h: (n: number) => number = …`, which holds the plain function. *Runtime:* the value carries `F` as its `[$direct]` property, keyed by the runtime's symbol (D268): an eligible function its plain variant, attached where its declaration or literal is evaluated, and a function with a plain return annotation or a protocol member itself. Before the exporting module's body has attached it, as in a module cycle, a call reaches the plain form through the hoisted function (Chapter 26, D446).

```ts es
export function double(n: number) { return n * 2 }   // Plain<(n: number) => number, (n: number) => Effect<number>>
let g = double
export const four = g(2)                              // 4: a plain call at a module's top level
export const api = { double, triple(n: number) { return n * 3 } }
export const six = api.triple(2)                      // 6
export const doubled = [1, 2].map(api.double)        // [2, 4]
export function makeApi() { return { half(n: number) { return n / 2 } } }
export const one = makeApi().half(2)                  // 1, from source and from declarations
```

An Effect-contract function performs, to its callers, the Effect operation its contract names, so calling one makes a caller ineligible for the plain form (Chapter 15). Producers are Chapter 8's.

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
| `using x = e`'s initializer | Where the declaration stands, with the interruptibility in force there; the release is registered as it gives its value, with nothing between (Chapter 6, D490) | Once per evaluation of the declaration |
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
- **H4. Recognition by symbol.** A rule that gives a name a special meaning applies only when the name resolves, through import aliases and re-exports, to the declaration the rule names. This covers runners (D38, D135), hatches (D148), `wire` (D27, D363), the prelude's functions, the built-in matchers such as `Option.Some` and `Number` (D208), the data-type method table (D152), a module's same-named export (D311), a function's trusted contract, and every exception list a diagnostic uses. A local declaration with the same spelling is an ordinary binding without that meaning; an alias of the declaration has all of it, except that the bindings of `fork`, `join`, and the hatches cannot be renamed or stored (EK4410, D432): `fork`'s and a hatch's first operand is deferred (rule D), and `join`'s is evaluated once and joined (E7), by syntax only those spellings carry (D462).
- **H5. Keywords.** `fork e`, `join e`, `await.all`, `await.allSettled`, `await.race`, `await.any`, `provide L { }`, `x catch y`, `do { }`, `match`, `is`, `using`, `for concurrent`, and the mask blocks are syntax: no binding changes the forms written without parentheses. `fork` and `join` are contextual keywords, and only their parenthesized spelling follows a binding (D391). `fork(x)` and `join(x)` always parse as TypeScript parses a call of an identifier, so a member access, an element access, or a call after the `)` applies to the value of the whole form, as after any call: `fork(work()).join()` forks `work()` and joins the fiber (D452). What the form means follows the binding: where `fork` or `join` resolves to the prelude's own, it is the keyword, `fork`'s one operand deferred by syntax (rule D) and `join`'s evaluated once (E7) (D462); where it resolves to a binding the program declares or imports, it is an ordinary call of that binding. The parse is the same either way, so the grammar never depends on a binding. The prelude's own `fork` and `join` are reached only through those spellings: an import that renames either, a member of a namespace import of the runtime, such as `R.fork(x)`, and any other reference to either, such as `const spawn = fork`, is EK4410, as a renamed or stored hatch is, so no call spelled otherwise defers its operand (D432, D452). The await operations take a parenthesized operand the same way: `await.all([a(), b()])` is a call in shape, so `await.all([a(), b()]).length` is the number of results, and the elements of its array or object literal operand are deferred, as without the parentheses (rule D, D462); `await` cannot be a binding.
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

A module's top level is inside no program. A call there may build values, such as `Layer.effect(…)`, `wire(…)`, `Config.Port(…)`, or `Schedule.exponential(…)`, and plain calls run there, a call of a plain function among them (D445), but any other call that runs a program is EK1001:

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
| `fork e`, `join e`, `await.all e`, `await.allSettled e`, `await.race e`, `await.any e` | As `await` binds its operand: `fork a().b` forks `a().b`. The operand starts on the keyword's line. A parenthesized form, `fork(e)`, `join(e)`, or `await.all(e)`, is a call in shape: what follows its `)` applies to its value | D166, D196, D225, D452 |
| `throw e` in an expression | Takes a unary expression, as in the proposal; a throw that is, or ends, a binary operator's left operand, a conditional's condition, or the operand of `as` or `satisfies` is EK1010 | D186 |
| `x is P` | At `instanceof`'s precedence | D211 |
| `x catch y`, `x catch (e) => h` | Looser than every binary operator, `??` and `\|\|` included; tighter than `? :`, assignment, arrow functions, and `\|>`; left-associative | D237 |
| `x \|> body` | Looser than every binary operator and `? :`, as an assignment is; left-associative; the body is a conditional expression | D154 |

A contract's `!` slots bind in types as Chapter 14's table says. Calls, `new`, member access, and every other operator keep TypeScript's precedence.

#### Where a type decides

A type rejects programs. In these places, and no others, a type also decides what a program does [Rule] (D413):

| Where | What the type decides | What it never decides |
| --- | --- | --- |
| Whether a call runs (rule R, D321, D458, D480) | A call runs when the declared return type of the signature it resolves to is definitely an Effect, a plain function's plain signature included, as a call of a Kotlin `suspend` function suspends. This is deliberate, and it is the only place a type makes a call run: changing a callee's declared return type from data, such as an `Exit`, a type parameter, or a union with a non-Effect member, to an Effect makes its calls run | When or how often the call's operands are evaluated; and which construct declares a type parameter that the return type names: a class's, an interface's, and an alias's are read alike, as TypeScript instantiates them for the call (D458, D486), and the callee's type is read as TypeScript writes it, so a declaration file gives the same answer (D491). A type that extends `Effect` is data whatever construct spells it (D393) |
| A function value's form (rule F, D324, D392, D421, D422) | Whether a function is passed in its plain form, its Effect form, or as a program, from the declared type at its destination; where the destination accepts both function forms, the function's own form (D112); and an unannotated parameter's type, from the contextual signature TypeScript gives the function, which the overload it picks and, through inference, the call's own contextual type decide, and which the own form reads (D482, D494); and which elements a spread in a literal at such a destination converts, from their static types (D423, D453). So it decides what the receiver's call of the function does: a call of the plain form runs the body, and a call of the Effect form builds a program whose body runs only when the receiver runs it (D447) | That passing or converting the function runs anything: neither runs any of its body; which overload a call resolves to, which follows the arguments' own types as in TypeScript |
| A contract-less callback type (Chapter 16, D331, D398) | Whether a call of a parameter typed `(a: A) => B` runs: written in a `.vibe` file, the type is an Effect function type, and the call runs; declared in TypeScript, it is plain | Anything outside a parameter position, where a contract-less function type means what TypeScript means |
| A method's form (Chapter 10, D397) | Whether an unannotated method that implements a member of a declared interface or base class is plain: it is, where that member, read by its declaration with its declaring type's own type parameters uninstantiated, is plain (D492) | The form of any other method, which its annotation or its name decides |
| A function's plain return annotation (D67, D385) | Whether TypeScript callers receive a plain function or a function that returns a cold `Effect` | What a VibeLang caller observes |
| A method on an Effect data type (D152, D336) | Which module function `x.name(args)` calls, from the receiver's type, as an extension method | Evaluation order: the receiver first, then the arguments |
| An await operation's operand that is not a literal (Chapter 7, D394) | That each element is a program to run on its own fiber, from the operand's element type; any other element type is rejected | How often the operand is read: once per run of the operation |
| `using` (Chapter 6, D401, D490) | Whether `using x = e` may bind a value it cannot dispose: where `e`'s requirements include `Scope` it may, and adds no release, since the acquisitions in `e` own what they made; any other such value, which only a cast can produce, is a `TypeError` | Who releases a value it can dispose, and how many times: the acquisition's run-time record and the value decide that, and the answer is once; and when interruption reaches `e`, which is where it would reach `yield* e`, one program for every initializer (D490) |
| `wire` (Chapter 4, D363) | The order in which its layers are built, from their Layer types | The order in which its arguments are evaluated: source order |

Every other rule reads syntax, resolved symbols, or run-time values. A program that a type would make mean something else is rejected instead. Optimizations are not on this list: rule E11 makes each one unobservable, so a type that lets the compiler choose a faster form decides nothing a program can see.
