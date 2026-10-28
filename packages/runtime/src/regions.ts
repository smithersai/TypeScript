import { Cause, Effect, Exit, Scope } from "effect"
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

type Suppressed = Error & { readonly error: unknown; readonly suppressed: unknown }
type SuppressedConstructor = new (error: unknown, suppressed: unknown, message?: string) => Suppressed

/** ECMAScript's SuppressedError, or the runtime's own where the host lacks it (D340). */
const SuppressedError: SuppressedConstructor = (globalThis as { SuppressedError?: SuppressedConstructor }).SuppressedError ??
  class SuppressedError extends Error {
    constructor(readonly error: unknown, readonly suppressed: unknown, message?: string) {
      super(message)
      this.name = "SuppressedError"
    }
  }

// The cause that each SuppressedError the runtime made stands for (D340).
const joined = new WeakMap<object, Cause.Cause<unknown>>()

/**
 * D340: the exception that leaves plain code for a cause with a defect. A
 * plain function never fails, so only defects leave it, and two failures
 * leave as a `SuppressedError` whose `error` is the later one and whose
 * `suppressed` is the earlier, as ECMA-262's DisposeResources reports them.
 * The runtime records the cause it stands for, its failures elected to
 * defects (D305), and turns it back into that cause where it reaches plain
 * code's catch or finally, or an Effect frame ($joinedFrame, $joinedSync).
 */
const defectFor = (cause: Cause.Cause<unknown>): unknown => {
  const values = cause.reasons.flatMap((reason) => Cause.isFailReason(reason) ? [reason.error] : Cause.isDieReason(reason) ? [reason.defect] : [])
  let thrown = values[0]
  for (let i = 1; i < values.length; i++) {
    thrown = new SuppressedError(values[i], thrown, "A cleanup failed while another failure was in flight")
    joined.set(thrown as Suppressed, K.electDefects(Cause.fromReasons(cause.reasons.slice(0, i + 1))))
  }
  return thrown
}

// The JavaScript value a thrown value stands for once a defect is present.
const defectOf = (thrown: unknown): unknown => thrown instanceof ExpectedFailure ? defectFor(thrown.cause) : thrown

/** D54: `throw e` in a function that compiles to plain JavaScript throws `$expected(e)`. */
export const $expected = (error: unknown): unknown => new ExpectedFailure(error)

/**
 * D54, D15: a finally block of a function that compiles to plain JavaScript
 * that throws while a failure is in flight. The two join, the pending failure
 * first, as `$finally`'s Effect.onExit combines causes, rather than the
 * finally block's replacing the other as in JavaScript: a catch outside
 * recovers the first expected failure, and a defect on either side makes the
 * whole a defect, which leaves as a `SuppressedError` whose `error` is the
 * finally block's exception and whose `suppressed` is the pending one (D340).
 * pending is `$normal` when no failure was in flight.
 */
export const $finallyFailure = (pending: unknown, thrown: unknown): unknown => {
  if (pending === $normal) return thrown
  const cause = Cause.combine(causeOf(pending), causeOf(thrown))
  if (!cause.reasons.some(Cause.isDieReason)) {
    const failure = cause.reasons.find(Cause.isFailReason) as Cause.Fail<unknown>
    return new ExpectedFailure(failure.error, cause)
  }
  const suppressed = new SuppressedError(defectOf(thrown), defectOf(pending), "A cleanup failed while another failure was in flight")
  joined.set(suppressed, K.electDefects(cause))
  return suppressed
}

// The cause a value thrown in plain code stands for: an expected failure's,
// a SuppressedError's that the runtime made, and otherwise a defect.
const causeOf = (thrown: unknown): Cause.Cause<unknown> =>
  thrown instanceof ExpectedFailure ? thrown.cause : joinedCause(thrown) ?? Cause.die(thrown)

const joinedCause = (thrown: unknown): Cause.Cause<unknown> | undefined =>
  typeof thrown === "object" && thrown !== null ? joined.get(thrown) : undefined

/**
 * D340: the Effect form of a plain function that can throw a
 * SuppressedError the runtime made. It runs the plain form as `Effect.sync`
 * does, and fails with the cause that SuppressedError stands for, so the
 * caller sees what the frame lowering of the same code gives.
 */
export const $joinedSync = <A>(plain: () => A): Effect.Effect<A> =>
  Effect.suspend(() => {
    try {
      return Exit.succeed(plain())
    } catch (thrown) {
      const cause = joinedCause(thrown)
      if (cause === undefined) throw thrown
      return Exit.failCause(cause) as unknown as Exit.Exit<A>
    }
  })

/**
 * D340: a generated frame that calls plain code which can throw a
 * SuppressedError the runtime made. Effect makes an exception that leaves a
 * frame one defect; this adapter instead fails the frame with the cause the
 * SuppressedError stands for, as the frame lowering of the same code would.
 * A frame that threw is finished, so Effect, which runs the failure, never
 * resumes it.
 */
export const $joinedFrame = <F extends (...args: any[]) => Generator<Effect.Effect<any, any, any>, any, any>>(body: F): F => {
  const wrapped = function(this: unknown, ...args: Parameters<F>) {
    const iterator = Reflect.apply(body, this, args) as Generator<Effect.Effect<any, any, any>, any, any>
    const step = (resume: () => IteratorResult<Effect.Effect<any, any, any>, any>): IteratorResult<Effect.Effect<any, any, any>, any> => {
      try {
        return resume()
      } catch (thrown) {
        const cause = joinedCause(thrown)
        if (cause === undefined) throw thrown
        return { done: false, value: Effect.failCause(cause) }
      }
    }
    return {
      next: (value?: unknown) => step(() => iterator.next(value)),
      throw: (error?: unknown) => step(() => iterator.throw(error)),
      return: (value?: unknown) => iterator.return(value),
      [Symbol.iterator]() {
        return this
      }
    }
  }
  Object.defineProperty(wrapped, "length", { value: body.length, configurable: true })
  Object.defineProperty(wrapped, "name", { value: body.name, configurable: true })
  return wrapped as unknown as F
}

/**
 * D54, D13: a catch in a function that compiles to plain JavaScript starts
 * with `e = $caught(e)`. It returns the expected failure, and rethrows
 * anything else, a defect, so the catch never sees it.
 */
export const $caught = (thrown: unknown): unknown => {
  if (thrown instanceof ExpectedFailure) return thrown.error
  throw thrown
}
