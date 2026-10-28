### 14. Contracts and inference

#### What the compiler infers

An eligible function with a plain return annotation keeps its plain type (D67, Chapter 15). An unannotated function, or one with an Effect return annotation, gets a contract `Effect<A, E, R>`:

- **A** is its return type, inferred and widened as TypeScript infers one: `return "ok"` gives `string`.
- **E** is every error it `throw`s, plus every error its callees can fail with, plus the expected failures named by the trusted contracts it calls, minus what its `catch` blocks handle.
- **R** is every service and control operation it uses, plus its callees' requirements, minus what it provides or handles itself, plus `Scope` if a resource it acquires without `using` outlives it (Chapter 6).

```ts es
function quoteCart(cartId: string) {
  const cart = Carts.load(cartId)              // E: CartNotFound   R: Carts
  if (cart.items.length === 0) throw new EmptyCart({ cartId })
  try {
    return Pricing.quote(cart)                 // E: PricingDown    R: Pricing
  } catch (e) {                                // e: PricingDown
    return estimate(cart)                      // a pure VibeLang helper
  }
}
// Quote!CartNotFound | EmptyCart!Carts | Pricing
```

`PricingDown` is caught, so it is not in E, but `Pricing` stays in R: catching an error does not remove the need for the service.

Precisely, E is the type of every expected failure a cause can hold. A defect beside expected failures makes them defects (D305), and `catch` recovers an expected failure beside an interruption, as `Effect.catch` does (D306), so no `Fail` reason escapes E. Chapter 17 states this guarantee, E bounds the `Fail` reasons that leave a function and nothing else (D355), and Chapter 26 lists every assumption the static guarantees rest on (D373).

#### Writing contracts

`.vibe` code writes `Effect<A, E, R>` as `A!E!R` (D127, D309) wherever a type can appear: return annotations, service members, parameters, and aliases. The parser expands it to `Effect.Effect<A, E, R>`.

| Written | Means |
| --- | --- |
| `User!NotFound!Db` | `Effect<User, NotFound, Db>` |
| `User!NotFound!` | `Effect<User, NotFound, never>` |
| `User!!Db` | `Effect<User, never, Db>` |
| `User!!` | `Effect<User, never, never>` |
| `User!NotFound` on a function with a body | `Effect<User, NotFound, infer R>`: R comes from the body |
| `User!NotFound` without a body | `Effect<User, NotFound, never>` |

An empty slot is `never`. Dependencies left out entirely are inferred on a function with a body and `never` everywhere else. Unions and intersections bind inside a slot, as do postfix `[]`, indexed access, and the prefix operators `keyof` and `typeof`, so `User!NotFound | Timeout!Db` fails with `NotFound | Timeout`. A slot's type starts on the same line as its `!`. An object type after a `!` needs parentheses: a `{` there starts the function's body, so `User!NotFound! { ... }` has no dependencies.

Function and conditional types keep their TypeScript structure within a slot. A `!` after a function's return type belongs to that return type. A conditional after a slot's type belongs to that slot. Parentheses delimit a slot that contains a function, conditional, or Effect type, or make the whole contract the subject of an outer type operator:

| Written | Parsed as |
| --- | --- |
| `A!E!R[]` | `Effect<A, E, R[]>` |
| `T["value"]!E!R["dep"]` | `Effect<T["value"], E, R["dep"]>` |
| `keyof T!E!typeof source` | `Effect<keyof T, E, typeof source>` |
| `A \| B!E1 \| E2!R` | `Effect<A \| B, E1 \| E2, R>` |
| `() => A!E!R` | `() => Effect<A, E, R>` |
| `A!E!R extends X ? Y : Z` | `Effect<A, E, R extends X ? Y : Z>` |
| `(A!E!R) extends X ? Y : Z` | `Effect<A, E, R> extends X ? Y : Z` |

Hovers and messages about `.vibe` code show contracts in the `!` form. Declaration files keep `Effect.Effect<A, E, R>`, so TypeScript callers are unaffected.

`Effect<A, E, R>` is accepted everywhere too, including `infer` slots (D57), and means what it means in TypeScript: a type argument left out is `never`, so `Effect<User>` is `User!!` and `Effect<User, NotFound>` is `User!NotFound!` (D308, D309). The two spellings name the same type wherever every channel is written, and this specification and the guides write the `!` form. They differ in one place, by a visible token: `User!NotFound`, with its last `!` and R left out, on a function with a body infers R, while `Effect<User, NotFound>` checks R as `never`, as does `User!NotFound!` (D335).

#### Checking a written contract

The compiler checks a body against its written contract:

```ts es
export function welcome(id: string): string!UserNotFound | MailError!Users {
  const user = Users.find(id)
  Mailer.send(user.email, "Welcome")
  return user.name
}
```

```text
error EK2002: welcome needs Mailer, but its contract says R = Users.
  welcome.vibe:3:3   Mailer.send(user.email, "Welcome")
  Provide Mailer inside welcome, or add it: Effect<string, UserNotFound | MailError, Users | Mailer>.
```

| Check | Rule | Diagnostic |
| --- | --- | --- |
| Success | The returned value must be assignable to A | TypeScript's |
| Errors | Every error that can escape must be in E; `A!!R` allows `catch` inside and rejects any error that escapes | EK2001 |
| Requirements | Every requirement that remains must be in R | EK2002 |
| Width | A contract may be wider than the body needs, never narrower | EK2001, EK2002 |

A call contributes its callee's contract as declared. Each channel a contract writes is what callers see, even when the body needs less, and each channel it leaves to inference is what the body needs (D73, D335). So callers of `function find(id: string): User!NotFound { … }` see E = `NotFound` and the body's R.

The contract has exactly three channels. Whether a function can pause is a separate fact the compiler tracks, its control class (Chapter 15).

#### Assignability

`A!E!R` is an alias of Effect's type and is covariant in all three channels. Widening A, E, or R preserves assignability. For example, `A!E1!R1` is assignable to `A!E1 | E2!R1 | R2`. A function's parameter types still follow TypeScript's function variance rules.

**An Effect never satisfies a plain function type** [Rule] (D430). TypeScript lets `() => Effect<void>` stand where `() => void` is expected, and a caller of the plain type would drop the program unrun. So in a `.vibe` file, wherever TypeScript checks one type against another, in an assignment, an argument, a return, an initializer, or an `implements` clause, a call signature or method of the target whose return type is neither definitely an Effect nor a union with such a member, a plain function type, is not matched by a source signature or method whose return type, read as rule R reads a call of it, is definitely an Effect: that check is EK4301 (D448). Against overloads, the check is part of whether a candidate accepts an argument, in rule F's first step: a candidate whose parameter type has such a plain member does not accept the argument, TypeScript's order picks among the candidates that do, and EK4301 is reported only when none does (D453). Rule F's conversions apply first, so a function value whose own form is plain still reaches a plain destination as its plain variant; this rule checks the rest, an object's methods, a class's instances, and a function value known only by its type. A class meets a plain member only through a plain method: one with a plain annotation, a protocol method, or one that implements that member of an interface or base class its class declares (D397). An object literal's method is a function at its field's destination (rule F), so one written where a plain member is expected takes its plain own form or is EK4301.

```ts es
interface Resettable { reset(): void }

class Counter {
  n = 5
  reset() { this.n = 0 }                  // unannotated: an Effect method (D397)
}

const target: Resettable = new Counter()  // EK4301: a caller of reset() would drop its program
```

Write `class Counter implements Resettable`, which makes `reset` plain, or annotate it, `reset(): void`. The same check rejects passing `[new Counter()]` to a TypeScript function that takes `Array<{ reset(): void }>`.

A service's name, as a type, is its identifier: the service's members plus a required phantom brand whose type is the service's derived key (Chapter 4, D361). A type is assignable to the identifier only if it carries that brand, so two services with the same members are different types, and no structural type, `{ get(): number!! }` included, stands for either. An implementation has the service's shape, `Users.Shape`, and is checked against it. For `service Name: Shape`, `Name` is the identifier and `Shape` the implementation's type.

An `error` declaration creates a runtime class with a literal `_tag` and readonly fields, and its type is nominal (D407): the compiler gives it a private member that no code names, as TypeScript makes every class with a private member nominal, and its declaration file writes that member. Two packages' error classes with the same tag and fields are therefore different types, as their constructors and `instanceof` tests are. Two installed copies of one package version are not: TypeScript gives them one type while the run time has two constructors, so a class arm counts toward exhaustiveness only where the class's package resolves to one installed copy (Chapter 3, D427). A subclass is assignable to its base, as any subclass is. Class patterns narrow by derivation and keep their run-time test in every arm of every match (D405). Cases `match-class-patterns` and `match-class-patterns.fail` cover class matching.

A `data` declaration names Effect's `Data.TaggedEnum` union (D307). Its variants are structural types determined by their `_tag` and readonly fields. Matching variant shapes from different packages are assignable, with no brand added by the data declaration's name. A generic data type follows TypeScript's variance for each type parameter's use in its fields.

#### Declarations without bodies

Service members, control operations, `declare function`, and fields typed as functions have no body to infer from, so each states its contract without `infer`. A bare return type on a service or control method is EK2101, never a silent `A!!`. Either spelling states a contract there, and a channel left out is `never`: `find(id: string): User!NotFound` and `find(id: string): Effect<User, NotFound>` can fail with `NotFound` and need nothing (D93, D308, D309):

```ts es
service Rates {
  lookup(currency: string): number
}
```

```text
error EK2101: Rates.lookup has no body to infer from, so its contract must be written as an Effect type.
  rates.vibe:2:38   abstract lookup(currency: string): number
  Write number!Errors!Dependencies; use number!! if it cannot fail and needs nothing.
```

A service's value members are not calls, so they take any type: `abstract readonly baseUrl: string`. Callback parameter types are the one exception to written contracts: there a missing contract means "any contract", not an empty one, and a written contract names those channels `E` and `R` (Chapter 16, D434).

#### Partial annotations

In the return annotation of a function with a body, a channel written `infer Name` comes from the body; every other channel is checked (D57). The `!` form leaves dependencies to the body when it leaves them out, `User!NotFound`; `Effect<…>` checks a channel it leaves out as `never`, as TypeScript's defaults make it (D308, D309).

```ts es
function find(id: string): Effect<User, infer E, never> {
  return Effect.fail(new UserNotFound({ id }))
}
// Checks A = User and R = never; infers E = UserNotFound.

function load(id: string): Effect<User, never, infer R> {
  return Effect.orDie(() => Users.find(id))
}
// Checks A = User and E = never; infers R = Users.

function plan(id: string): Effect<infer A, UserNotFound, Users> {
  return Users.find(id).name
}
// Infers A = string; checks E = UserNotFound and R = Users.

function greeting(id: string): Effect<string, infer E, infer R> {
  return `Hello, ${Users.find(id).name}`
}
// Checks A = string; infers E = UserNotFound and R = Users.

function inferred(id: string): Effect<infer _, infer _, infer _> {
  return Users.find(id)
}
// User!UserNotFound!Users, as with no annotation.
```

The name after `infer` is documentation only, not in scope in any channel or in the body. `infer _` is allowed in any number of channels. A name other than `_` written in two channels of one contract, as in `Effect<infer Value, infer Value, never>`, is EK2129: the channels are not connected, as TypeScript's repeated `infer` would connect them, so the spelling would read as a promise it does not keep (D414).

A channel left out of `Effect<…>` is checked, never inferred: `Effect<User>` promises, as `User!!` does, that the function cannot fail and needs nothing, so a body that returns `Users.find(id)` under it is EK2001 for `UserNotFound` and EK2002 for `Users`. To check only A, write `Effect<User, infer E, infer R>`. A plain return annotation such as `: User` is EK2003 when a function's or a method's body runs an Effect, and when any function's throw or a trusted call's listed failure can escape, since a plain function never fails (D74, D282, D399); an eligible plain helper keeps that annotation and compiles to one plain function (D67). A method's annotation is its type in its declaration file and in every interface its class satisfies, so an Effect behind it would reach those callers unrun. A method implementing a plain-function member of a JavaScript protocol, such as `[Equal.symbol]`, is checked against that member instead, as EK4301 (D55). An unannotated class method's declaration determines whether it lowers to an Effect, never its body: it is plain where it implements a plain member or is a protocol method, and an Effect method otherwise (Chapter 10, D397); an object literal's method takes its own form as a function literal does (D448, D460).

`infer`, and the `!` form's inferred dependencies, apply only in the return annotation of a VibeLang function with a body. Everywhere else, in parameter types, type aliases, service members, and `.ts` files, an Effect type means what TypeScript means by it, `never` defaults included. A callback parameter without an Effect contract still accepts any contract (D12, Chapter 16).

#### Recursion

A recursive Effect function's E and R come from a fixpoint over its strongly connected component of the call graph. Cached catch-variable or return types can require a written contract before those channels are known (EK2102, D71):

```ts es
function totalSize(path: string) {
  const entry = Files.stat(path)
  if (!entry.isDirectory) return entry.size
  let total = 0
  for (const child of Files.list(path)) total += totalSize(`${path}/${child}`)
  return total
}
// number!IOError!Files
```

TypeScript cannot compute this alone: to it, the generated recursive function is an implicit `any` (TS7022). The compiler computes the fixpoint itself, inside the component only (D52): it checks the component's bodies, then rechecks only those bodies with the E and R found so far, until E and R stop growing. Rows only grow and are finite, so the iteration ends, and no function outside the component is checked twice. The recheck matters for mutual recursion:

```ts es
error Locked { path: string }

function visitDir(path: string) {
  for (const child of Files.list(path)) visitEntry(`${path}/${child}`)
}

function visitEntry(path: string) {
  if (path.endsWith(".lock")) throw new Locked({ path })
  if (Files.stat(path).isDirectory) visitDir(path)
}
// both: void!IOError | Locked!Files
```

Checked once in source order, `visitDir` meets `visitEntry` before `visitEntry` has a contract and misses `Locked`; the recheck adds it. The prototype compiler reaches the same contracts by re-checking the whole program (`prototype/esc/FINDINGS.md`). The single-pass experiment found this case, in its `isEven` and `isOdd` probe, the only one needing a second check (`prototype/single-pass/RESULTS.md`). A follows TypeScript's rule: when A depends on the function's own result, the contract must be written (EK2102).

A contract may write A and leave E or R to the fixpoint, as `number!Neg` leaves R (D57). A call of the function in its own body runs, as every call does (Chapter 13), so it has type A while the fixpoint runs:

```ts es
function fact(n: number): number!Neg {
  if (n < 0) throw new Neg({ n })
  if (n <= 1) return 1
  return n * fact(n - 1)
}
// number!Neg!never
```

Where the function is generic, TypeScript needs the contract before the fixpoint has its channels, so the contract must write every channel; EK2102's note gives it, such as `number!Neg!Audit`.

EK2102 applies to functions that run Effects. Pure recursion keeps TypeScript's TS7023 when its return type depends on itself; a plain annotation fixes it (D72). The current checker also needs contracts in some cached-type cycles that the fixpoint model alone would solve. A cycle through a callback uses the checker's single type for that call, and generic-call inference does not fill `infer` channels in a lambda (F3's known gaps).
