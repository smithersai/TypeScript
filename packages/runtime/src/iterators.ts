import { Effect } from "effect"

// The runtime loop's adapter (design chapter 26). It is not the close helper
// that D404 and D424 require around JavaScript's own for...of: that is the
// loop rewrite the compiler emits (closing.go), which joins a failing
// return() to the failure in flight with $finallyFailure. This adapter owns
// what that rewrite cannot see, a frame that Effect abandons.
//
// Effect abandons a generator at a failed or interrupted yield* without
// calling its return() (design chapter 24). A native for...of or an array
// destructuring in that generator would keep its iterator open: JavaScript
// closes one only when control leaves the loop or the pattern. The frame
// adapter keeps the native syntax, with its bindings, evaluation order and
// IteratorClose rules, and gives the Effect frame ownership of leaving it.
//
// When the generator did not finish, the finalizer resumes it with a return
// completion, as JavaScript's own abrupt exit would, and JavaScript runs
// IteratorClose for every live loop and pattern, innermost first. A return()
// that throws or returns a primitive propagates out of the generator, as it
// does from a native loop that exits by a jump, and fails the finalizer: a
// cleanup failure is a defect beside the original failure, defect or
// interruption, never dropped (D305, chapter 17).

/** @internal Compiler ABI: give Effect ownership of a generator's live native iterators. */
export const $iteratorFrame = <F extends (...args: any[]) => Generator<Effect.Effect<any, any, any>, any, any>>(
  body: F
): F => {
  const wrapped = function(this: unknown, ...args: Parameters<F>) {
    const iterator = Reflect.apply(body, this, args)
    return (function*() {
      return yield* Effect.onExit(Effect.gen(() => iterator), () => Effect.sync(() => unwind(iterator)))
    })()
  }
  Object.defineProperty(wrapped, "length", { value: body.length, configurable: true })
  Object.defineProperty(wrapped, "name", { value: body.name, configurable: true })
  return wrapped as F
}

// A finished generator ignores return(). Source catch and finally are Effect
// regions, never JavaScript try statements (chapter 26), so nothing in the
// generator intercepts the return completion to yield again; a frame that
// does is a defect, since its cleanup cannot run here.
const unwind = (iterator: Generator<unknown, unknown, unknown>) => {
  if (!iterator.return(undefined).done) {
    throw new Error("a generator yielded while its iterator frame was unwound: a JavaScript finally block ran an Effect")
  }
}
