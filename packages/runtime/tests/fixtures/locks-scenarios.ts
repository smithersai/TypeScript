// Observes the experimental Locks service against a real lock manager: Chromium's
// navigator.locks through BrowserLocks.layer (locks-browser.ts), and Node.js's through
// NodeLocks.layer (locks-node.ts). Ported from the cases of Smithers' WebLock suite.
import * as Cause from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Fiber from "effect/Fiber"
import type * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Scope from "effect/Scope"
import { Locks } from "vibelang-runtime/experimental"

let names = 0
const fresh = () => `locks-${Date.now()}-${names++}`

/** Holds `name` in a fresh scope and returns it, so a case can release it. */
const hold = (name: string, options?: Locks.HoldOptions) =>
  Effect.gen(function*() {
    const locks = yield* Locks.Locks
    const scope = yield* Scope.make()
    const held = yield* locks.hold(name, options).pipe(Scope.provide(scope))
    return Object.assign(scope, { held })
  })

/** How many contexts hold `name` now, and how many wait for it. */
const holders = (name: string) =>
  Effect.gen(function*() {
    const locks = yield* Locks.Locks
    const { held, pending } = yield* locks.query
    return {
      held: held.filter((lock) => lock.name === name).length,
      pending: pending.filter((lock) => lock.name === name).length
    }
  })

/** Who holds and waits for `name` once `done` holds of it, or after 2 seconds. */
const eventually = (name: string, done: (now: { readonly held: number; readonly pending: number }) => boolean) =>
  Effect.gen(function*() {
    for (let tries = 0;; tries++) {
      const now = yield* holders(name)
      if (done(now) || tries === 100) return now
      yield* Effect.sleep("20 millis")
    }
  })

/** Who holds and waits for `name` once the lock manager has let go of it. */
const released = (name: string) => eventually(name, (now) => now.held === 0 && now.pending === 0)

/** Who holds and waits for `name` once a request waits for it. */
const awaited = (name: string) => eventually(name, (now) => now.pending > 0)

// What an Effect expected to be refused ended with: its PlatformError's reason, or a defect.
const reason = (exit: Exit.Exit<unknown, { readonly reason: { readonly _tag: string; readonly method: string } }>) =>
  Exit.isSuccess(exit) ? "success" : Option.match(Cause.findErrorOption(exit.cause), {
    onNone: () => "defect",
    onSome: (error) => `${error.reason._tag} ${error.reason.method}`
  })

const scenarios = Effect.gen(function*() {
  const locks = yield* Locks.Locks

  // One holder at a time; the next when the holder lets go.
  const exclusive = yield* Effect.gen(function*() {
    const name = fresh()
    const first = yield* hold(name)
    const second = yield* Effect.forkChild(hold(name))
    const whileWaiting = yield* awaited(name)
    yield* Effect.sleep("50 millis")
    const waiting = second.pollUnsafe() === undefined
    yield* Scope.close(first, Exit.void)
    yield* Scope.close(yield* Fiber.join(second), Exit.void)
    return { waiting, whileWaiting, after: yield* released(name) }
  })

  // An interrupted wait is withdrawn, so it never takes the lock.
  const withdrawn = yield* Effect.gen(function*() {
    const name = fresh()
    const first = yield* hold(name)
    const waiting = yield* Effect.forkChild(hold(name))
    yield* Effect.sleep("20 millis")
    yield* Fiber.interrupt(waiting)
    yield* Scope.close(first, Exit.void)
    return yield* released(name)
  })

  // A steal takes a held lock at once; the holder learns it lost the lock and keeps no claim.
  const stolen = yield* Effect.gen(function*() {
    const name = fresh()
    const first = yield* hold(name)
    const lost = yield* Effect.forkChild(first.held.lost)
    const second = yield* hold(name, { steal: true })
    yield* Fiber.join(lost)
    const afterSteal = yield* holders(name)
    // Closing the robbed holder's scope gives back nothing it still holds.
    yield* Scope.close(first, Exit.void)
    const afterRobbedClose = yield* holders(name)
    const third = yield* Effect.forkChild(hold(name))
    yield* Effect.sleep("20 millis")
    const thirdWaits = third.pollUnsafe() === undefined
    yield* Scope.close(second, Exit.void)
    yield* Scope.close(yield* Fiber.join(third), Exit.void)
    return { afterSteal, afterRobbedClose, thirdWaits }
  })

  // A steal of a free lock holds it; a lock held to the end is never lost.
  const stealFree = yield* Effect.gen(function*() {
    const name = fresh()
    const stolen = yield* hold(name, { steal: true })
    const whileHeld = yield* holders(name)
    const lost = yield* Effect.forkChild(stolen.held.lost)
    yield* Scope.close(stolen, Exit.void)
    yield* Effect.sleep("20 millis")
    return { whileHeld, neverLost: lost.pollUnsafe() === undefined, after: yield* released(name) }
  })

  // tryHold takes a free lock; a held or awaited one it answers none, at once.
  const tried = yield* Effect.gen(function*() {
    const name = fresh()
    const scope = yield* Scope.make()
    const taken = Option.isSome(yield* locks.tryHold(name).pipe(Scope.provide(scope)))
    const whileTaken = yield* holders(name)
    const refused = Option.isNone(yield* locks.tryHold(name).pipe(Effect.scoped))
    const afterRefusal = yield* holders(name)
    // A waiting request makes the lock taken too, even once its holder lets go.
    const waiting = yield* Effect.forkChild(hold(name))
    yield* Effect.sleep("20 millis")
    yield* Scope.close(scope, Exit.void)
    const next = yield* Fiber.join(waiting)
    const refusedToWaiter = Option.isNone(yield* locks.tryHold(name).pipe(Effect.scoped))
    yield* Scope.close(next, Exit.void)
    return { taken, whileTaken, refused, afterRefusal, refusedToWaiter, after: yield* released(name) }
  })

  // A lock tryHold took can be stolen, and its holder learns so.
  const triedStolen = yield* Effect.gen(function*() {
    const name = fresh()
    const scope = yield* Scope.make()
    const taken = Option.getOrThrow(yield* locks.tryHold(name).pipe(Scope.provide(scope)))
    const lost = yield* Effect.forkChild(taken.lost)
    const thief = yield* hold(name, { steal: true })
    yield* Fiber.join(lost)
    yield* Scope.close(scope, Exit.void)
    const afterClose = yield* holders(name)
    yield* Scope.close(thief, Exit.void)
    return { afterClose }
  })

  // query describes each lock fully.
  const described = yield* Effect.gen(function*() {
    const name = fresh()
    const first = yield* hold(name)
    const second = yield* Effect.forkChild(hold(name))
    yield* awaited(name)
    const { held, pending } = yield* locks.query
    const mine = [...held, ...pending].filter((lock) => lock.name === name)
    yield* Scope.close(first, Exit.void)
    yield* Scope.close(yield* Fiber.join(second), Exit.void)
    return mine.map((lock) => `${lock.mode} ${typeof lock.clientId === "string" && lock.clientId.length > 0}`)
  })

  // The lock manager refuses a name that starts with "-": a BadArgument, not a defect.
  const refused = {
    hold: reason(yield* Effect.exit(Effect.scoped(locks.hold("-reserved")))),
    steal: reason(yield* Effect.exit(Effect.scoped(locks.hold("-reserved", { steal: true })))),
    tryHold: reason(yield* Effect.exit(Effect.scoped(locks.tryHold("-reserved"))))
  }

  return { exclusive, withdrawn, stolen, stealFree, tried, triedStolen, described, refused }
})

/** Runs every scenario over `layer`. */
export const observe = (layer: Layer.Layer<Locks.Locks>) => Effect.provide(scenarios, layer)

/**
 * One context's part in a contest over `name` with other tabs, threads or
 * processes, reported through `report`: "holder" holds it until its context
 * ends, "waiter" first tries it, then waits for it and holds it, "thief"
 * steals it, "trier" only tries it.
 */
export const contend = (
  layer: Layer.Layer<Locks.Locks>,
  role: string,
  name: string,
  report: (event: string) => void
) =>
  Effect.gen(function*() {
    const locks = yield* Locks.Locks
    if (role === "trier") {
      report(Option.isSome(yield* locks.tryHold(name).pipe(Effect.scoped)) ? "taken" : "refused")
      return
    }
    if (role === "waiter") report(Option.isSome(yield* locks.tryHold(name).pipe(Effect.scoped)) ? "taken" : "refused")
    const held = yield* locks.hold(name, { steal: role === "thief" })
    report("held")
    yield* held.lost
    report("lost")
    yield* Effect.never
  }).pipe(Effect.scoped, Effect.provide(layer))
