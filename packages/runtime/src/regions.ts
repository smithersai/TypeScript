import { Cause, Effect, Scope } from "effect"
import * as K from "./kernel/kernel.js"

export const $normal = { kind: "normal" } as const

/** D13, D306: `catch` recovers the first expected failure of a cause with no defect, as `Effect.catch` does (the kernel's `catchExpected`). */
export const $catch: <A, E, R, B, E2, R2>(
  self: Effect.Effect<A, E, R>,
  handler: (error: E) => Effect.Effect<B, E2, R2>
) => Effect.Effect<A | B, E2, R | R2> = K.catchExpected

/**
 * A catch expression (D236): `program catch fallback` and
 * `program catch (e) => handler`. The parser passes both sides as functions,
 * so the left side runs inside the catch and a fallback runs only after an
 * expected failure; defects and interrupts pass through, as `catch (e)`
 * statements let them.
 */
export const $catchExpression = <A, E, R, B, E2, R2>(
  self: () => Effect.Effect<A, E, R>,
  handler: (error: E) => Effect.Effect<B, E2, R2>
): Effect.Effect<A | B, E2, R | R2> => K.catchExpected(Effect.suspend(self), handler)

/**
 * A typed catch clause, `catch (e: NotFound)`, tests the caught failure with
 * the _tag of each type it names (D131); the compiler passes the tags. The
 * form is retired (D216) but still compiles, with the warning EK2112.
 */
export function $isFailure<T>(value: unknown, ...tags: ReadonlyArray<string>): value is T {
  return typeof value === "object" && value !== null && tags.includes((value as { readonly _tag?: unknown })._tag as string)
}

/** `finally`: runs on every exit; a failure inside it is never dropped (D15; onExit merges causes). */
export const $finally = <A, E, R, X, E2, R2>(
  self: Effect.Effect<A, E, R>,
  finalizer: Effect.Effect<X, E2, R2>
): Effect.Effect<A, E | E2, R | R2> => Effect.onExit(self, () => Effect.asVoid(finalizer))

/** A block with `using` or `fork`: a Scope region whose Scope is not put in the Context (D14). */
export const $region = <A, E, R>(body: (scope: Scope.Scope) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.scopedWith(body)

/**
 * `using x = acquire()`: only this acquisition sees the block's Scope (D14,
 * Codex R8). The acquisition keeps the interruptibility its own
 * `acquireRelease` gives it (D25), so it runs under `restore`, with a Scope
 * of its own inside the block's. Once its value reaches `$using`, the block's
 * release of it is registered with interruption masked: `[Symbol.dispose]()`
 * for a Disposable from either kind of acquisition (D94), and an awaited
 * `[Symbol.asyncDispose]()` for an AsyncDisposable without `Symbol.dispose`
 * whose acquisition registered no release of its own. A resource that
 * releases itself, such as an `acquireRelease`, is never released again
 * asynchronously.
 *
 * An interruption that arrives while the acquisition is masked is delivered
 * as that mask ends, inside `restore`. When the mask ends the acquisition,
 * the value never reaches `$using` and the block does not release it (the
 * pending case scopes-using-pending-interrupt; D25's note of 2026-10-23).
 */
export const $using = <A, E, R>(scope: Scope.Scope, acquire: Effect.Effect<A, E, R>): Effect.Effect<A, E, Exclude<R, Scope.Scope>> =>
  Effect.uninterruptibleMask((restore) => {
    const own = Scope.forkUnsafe(scope)
    return Effect.tap(restore(Scope.provide(acquire, own)), (value: unknown) => {
      const release = disposal(value, own.state._tag !== "Empty")
      return release === undefined ? Effect.void : Scope.addFinalizer(scope, release)
    })
  })

/**
 * The block's release of a `using` value, or undefined when it has none:
 * `[Symbol.dispose]()`, else, when the acquisition registered no release,
 * `[Symbol.asyncDispose]()` awaited. A throw or a rejection is a defect. As
 * JavaScript's `using` does, it reads the method once, when the value is
 * acquired, and calls that method with the value as `this` at block exit.
 */
const disposal = (value: unknown, releasesItself: boolean): Effect.Effect<void> | undefined => {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return undefined
  const resource = value as Partial<Disposable & AsyncDisposable>
  const dispose = resource[Symbol.dispose]
  if (typeof dispose === "function") return Effect.sync(() => void Reflect.apply(dispose, resource, []))
  if (releasesItself) return undefined
  const asyncDispose = resource[Symbol.asyncDispose]
  if (typeof asyncDispose === "function") return Effect.promise(() => Reflect.apply(asyncDispose, resource, []))
  return undefined
}

/**
 * D54: a failure in flight in a function that compiles to plain JavaScript,
 * which a catch of the function recovers: the cause a frame would carry, with
 * the expected failure a catch receives. Plain code throws every other cause
 * as one JavaScript value, which its catches pass through as a defect.
 */
class ExpectedFailure {
  constructor(readonly error: unknown, private readonly whole?: Cause.Cause<unknown>) {}
  get cause(): Cause.Cause<unknown> {
    return this.whole ?? Cause.fail(this.error)
  }
}

/**
 * What plain code throws for cause (D13, D306, as `$catch` decides): an
 * ExpectedFailure when a catch recovers the cause's first expected failure,
 * because it holds no defect; otherwise the one JavaScript value
 * Effect.runSync would throw for it once its defects are elected (D305):
 * its first failure or defect, in order, as `Cause.squash` gives.
 */
const thrownFor = (cause: Cause.Cause<unknown>): unknown => {
  if (!K.isAbortCause(cause) && !cause.reasons.some(Cause.isDieReason)) {
    const failure = cause.reasons.find(Cause.isFailReason)
    if (failure !== undefined) return new ExpectedFailure(failure.error, cause)
  }
  const first = cause.reasons.find((reason) => Cause.isFailReason(reason) || Cause.isDieReason(reason))
  return first === undefined ? Cause.squash(cause) : Cause.isFailReason(first) ? first.error : (first as Cause.Die).defect
}

/** D54: `throw e` in a function that compiles to plain JavaScript throws `$expected(e)`. */
export const $expected = (error: unknown): unknown => new ExpectedFailure(error)

/**
 * D54, D177: `throw cause` in a function that compiles to plain JavaScript
 * throws `$expectedCause(cause)`, which fails with every reason the cause
 * holds, as `Effect.failCause` does: a catch receives its first expected
 * failure only when it holds no defect.
 */
export const $expectedCause = (cause: Cause.Cause<unknown>): unknown => thrownFor(cause)

/**
 * D54, D15: a finally block of a function that compiles to plain JavaScript
 * that throws while a failure is in flight. The two join, the pending failure
 * first, as `$finally`'s Effect.onExit combines causes, rather than the
 * finally block's replacing the other as in JavaScript: a catch outside
 * recovers the first expected failure, and a defect on either side makes the
 * whole a defect. pending is `$normal` when no failure was in flight.
 */
export const $finallyFailure = (pending: unknown, thrown: unknown): unknown =>
  pending === $normal ? thrown : thrownFor(Cause.combine(causeOf(pending), causeOf(thrown)))

// The cause a value thrown in plain code stands for: anything but an expected
// failure is a defect.
const causeOf = (thrown: unknown): Cause.Cause<unknown> =>
  thrown instanceof ExpectedFailure ? thrown.cause : Cause.die(thrown)

/**
 * D54, D13: a catch in a function that compiles to plain JavaScript starts
 * with `e = $caught(e)`. It returns the expected failure, and rethrows
 * anything else, a defect, so the catch never sees it.
 */
export const $caught = (thrown: unknown): unknown => {
  if (thrown instanceof ExpectedFailure) return thrown.error
  throw thrown
}
