import { Context, Effect, Exit, Scope } from "effect"
import { asInternals } from "./kernel/internals.js"

type Restore = <A, E, R>(program: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>

/**
 * The interruptibility the code around a `using` had, while `using` holds
 * interruption off around its initializer (D425). An acquisition with
 * `{ interruptible: true }` inside the initializer runs its acquire step with
 * it, so `using`'s mask does not cover that step (D401). A mask written
 * inside the initializer, `uninterruptible { ... }`, clears it.
 */
export const UsingRestore = Context.Reference<Restore | undefined>("vibelang/UsingRestore", {
  defaultValue: () => undefined
})

/**
 * Runs `program` with interruption held off, as `using` holds it off around
 * an initializer whose value it may own (D425). `UsingRestore` gives the
 * acquisitions inside it the interruptibility the code around the `using`
 * had; inside another such region, that region's.
 */
export const holdingInterruption = <A, E, R>(program: (restore: Restore) => Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.withFiber((fiber) => {
    const outer = asInternals(fiber).interruptible ? undefined : fiber.getRef(UsingRestore)
    return Effect.uninterruptibleMask((restore) => {
      const around = outer ?? restore
      return Effect.provideService(program(around), UsingRestore, around)
    })
  })

/**
 * `Effect.acquireRelease`, as `vibelang-runtime` gives it: Effect's
 * arguments, and what Effect's does (D401). The acquire step is masked unless
 * `{ interruptible: true }`; the release is registered in the Scope the
 * acquisition runs with, in the same uninterruptible step that produces the
 * value. Inside a `using` initializer that holds interruption off, an
 * interruptible acquire step runs with the interruptibility the code around
 * the `using` had (`UsingRestore`), so cancellation reaches it there as it
 * would outside `using`. A `.vibe` reference to Effect's `acquireRelease`
 * denotes this one.
 */
export const acquireRelease = <A, E, R, R2>(
  acquire: Effect.Effect<A, E, R>,
  release: (a: A, exit: Exit.Exit<unknown, unknown>) => Effect.Effect<unknown, never, R2>,
  options?: { readonly interruptible?: boolean }
): Effect.Effect<A, E, R | R2 | Scope.Scope> =>
  Effect.withFiber((fiber) => {
    const around = options?.interruptible && !asInternals(fiber).interruptible ? fiber.getRef(UsingRestore) : undefined
    return Effect.contextWith((context: Context.Context<R2>) =>
      Effect.uninterruptibleMask((restore) =>
        Effect.flatMap(Effect.scope, (scope) =>
          Effect.tap(
            options?.interruptible ? (around ?? restore)(acquire) : acquire,
            (a) => Scope.addFinalizerExit(scope, (exit) => Effect.provideContext(release(a, exit), Context.add(context, UsingRestore, undefined)))
          )
        )
      )
    )
  })

/**
 * `Effect.acquireDisposable`, as `vibelang-runtime` gives it (D401): a
 * masked acquisition of a Disposable or an AsyncDisposable whose release
 * calls `[Symbol.asyncDispose]()` when the value has it, else
 * `[Symbol.dispose]()`, as Effect's does. A `.vibe` reference to Effect's
 * `acquireDisposable` denotes this one.
 */
export const acquireDisposable = <A extends AsyncDisposable | Disposable, E, R>(
  acquire: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R | Scope.Scope> =>
  acquireRelease(acquire, (resource) =>
    Symbol.asyncDispose in resource
      ? Effect.promise(() => (resource as AsyncDisposable)[Symbol.asyncDispose]())
      : Effect.sync(() => (resource as Disposable)[Symbol.dispose]()))
