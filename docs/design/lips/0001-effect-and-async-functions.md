# LIP-1: `effect` and `async` functions

**Status:** accepted by Will, 2026-10-28.

## Decision

```ts
effect function load(id) { return await fetchUser(id) }  // an Effect function
effect load(id) { return await fetchUser(id) }           // shorthand
effect (id) => await fetchUser(id)                       // arrow

async function get(url) { return await fetch(url) }      // a Promise function, as in TypeScript
async get(url) { return await fetch(url) }               // shorthand

class Users {
  effect find(id) { … }                                   // method
  async load() { … }
}

const c = (id) => fetchUser(id)   // neither keyword: plain JavaScript; returns the Effect unrun
```

- `effect` marks an Effect function, and `async` marks a Promise function. Each may appear wherever TypeScript allows `async`, and also in the declaration shorthand (`effect load()`, `async get()`). Outside those positions `effect` is an ordinary identifier, so `Layer.effect` and `const effect = …` still work.
- `await` unwraps both:
  - inside an `effect` function, `await e` runs the Effect `e`, as `yield*` does in `Effect.gen`;
  - inside an `async` function, `await` keeps its JavaScript meaning.
- Awaiting the wrong kind is an error:
  - `await` on a Promise inside an `effect` function;
  - `await` on an Effect inside an `async` function;
  - `await` inside a function with neither keyword, as in JavaScript.
- Calling an `effect` function returns its Effect unrun, just as calling an `async` function returns a Promise.
- To cross between them, use Effect's existing APIs: `Effect.promise` or `Effect.tryPromise` inside an `effect` function, and `Effect.runPromise` inside an `async` function. A shorter syntax is left to a later LIP.

## Prior art

- JavaScript and TypeScript `async function`, C# `async`, Rust `async fn`, Kotlin `suspend fun`. In each, a keyword on the function, never its body, decides its kind.
- Effect's `Effect.fn` and `Effect.gen`.

## Will's words

> "We should keep async await meaning promises. We should have effectful function use the keyword effect … await unwraps both. … awaiting a promise is not allowed in an effect function and awaiting an effect is not allowed in a async function."

> "I like your suggestion of having effect function load and just effect load. Let's do same with async so you can do async function get() or just async get()."

> "Going between effect and async already has existing support in promise if you are suggesting we should have more concise syntax for that keep that in mind but for another proposal."

## Supersedes

D550 (a function's kind inferred from `await` in its body), D541, the form rules of D500, and D456's "`async` only in a hatch".

## Left to later LIPs

- A shorter syntax for crossing between Promises and Effects.
- What `using`, `for await`, `try`/`catch` and `throw` mean inside each kind of function.
- Return annotations.
- Top-level `await` and `main`.
