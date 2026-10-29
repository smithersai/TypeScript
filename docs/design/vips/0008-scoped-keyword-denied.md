# VIP-8: a `scoped` keyword (denied)

**Status:** denied by Will, 2026-10-28.

## Proposal

Make `scoped` a contextual keyword that builds an Effect from a block, run with `try`, as sugar for Effect's `scoped`:

```ts
// proposed
effect load(q) {
  return try scoped {
    const db = try openDb()
    return try db.query(q)
  }
}

// the same today, with VIP-1 to 7 and the VIP-6 global
effect load(q) {
  return try scoped(effect {
    const db = try openDb()
    return try db.query(q)
  })
}

// Effect TS
const load = (q) => Effect.scoped(Effect.gen(function* () {
  const db = yield* openDb()
  return yield* db.query(q)
}))
```

## Background: Effect's scope functions (effect 4.0.6)

```ts
scoped(self: Effect<A, E, R>): Effect<A, E, Exclude<R, Scope>>   // a fresh Scope, closed when self ends
scopedWith((scope: Scope) => Effect<A, E, R>): Effect<A, E, R>   // the same, with the Scope passed as a value
scope: Effect<Scope, never, Scope>                               // read the current Scope
acquireRelease(acquire, (a, exit) => release, { interruptible?: boolean })
acquireDisposable(acquire)                                       // objects with Symbol.dispose or Symbol.asyncDispose
addFinalizer((exit) => cleanup)
```

- Acquiring adds `Scope` to R, and `scoped` provides it and removes it.
- Closing runs releases in reverse order, on success, failure or interruption.
- `scopedWith` is needed only when something takes a Scope by name, such as `forkIn(effect, scope)`. It stays a plain global function and gets no syntax.

## Why it was denied

The keyword is ambiguous as first sketched:
- `scoped(x)` parses two ways, as a call or as the keyword applied to `(x)`.
- VIP-6 removes a global when a keyword takes its name, so `pipe(program, scoped)` would break.

A rule could remove the ambiguity: `scoped` is a keyword only when `{` follows it on the same line. Will's standard is that any ambiguity is unacceptable, and `scoped(effect { … })` already works with no new syntax.

## Will's words

> "Ok if we make scoped a keyword is there ambiguity?"

> "If I ask a question like is there ambiguity the answer is yes or no. A little bit of ambigiouty is unacceptable"

> "Ok we should deny this. Deny it by keeping the proposal info about what we talked about and appending it to the end as a denied VIP"
