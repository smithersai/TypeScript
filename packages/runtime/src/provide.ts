import { Context, Effect, Layer } from "effect"

/**
 * A layer that provides one service, for a provider written `Key = value` in a
 * provide block (D173):
 *
 *     provide Clock = testClock, Users = fakeUsers { app() }
 *
 * compiles to `$provideEntries(..., [$provideService(Clock, "Clock", testClock),
 * $provideService(Users, "Users", fakeUsers)])`. The layer carries its key and
 * value, so `$provideEntries` provides the service as `Effect.provideService`
 * does, without building it. The key is a service key, such as a `service`
 * declaration, or a module whose export of the same name is one, so the
 * effect module `Clock` stands for `Clock.Clock`.
 *
 * One signature, with the name before the value, so TypeScript knows the key
 * and the name when it first checks the value. With an overload per form, it
 * checked the value against the first overload's shape, and a method in the
 * value took the form that shape gave it (D92) for every later overload.
 */
export function $provideService<const N extends string, K extends Context.Key<any, any> | { readonly [P in N]: Context.Key<any, any> }>(
  key: K,
  name: N,
  value: NoInfer<Context.Service.Shape<ProvidedKey<K, N>>>
): Layer.Layer<Context.Service.Identifier<ProvidedKey<K, N>>>
export function $provideService(key: any, name: string, value: unknown): Layer.Layer<any> {
  const service = Context.isKey(key) ? key : key[name]
  if (!Context.isKey(service)) {
    throw new TypeError(`provide ${name} = ...: ${name} is not a service key, and it has no service key named ${name}`)
  }
  const layer = Layer.succeed(service as Context.Key<any, any>)(value)
  ;(layer as any)[ServiceEntry] = { key: service, value } satisfies ServiceEntry
  return layer
}

const ServiceEntry = Symbol.for("vibelang/ServiceEntry")

/** The service a `$provideService` layer provides. */
interface ServiceEntry {
  readonly key: Context.Key<any, any>
  readonly value: unknown
}

/**
 * Runs `self` with a provide block's providers, typed as `Effect.provide`
 * with the same list. A `$provideService` layer is provided as
 * `Effect.provideService` provides its service: no Layer is built, so no
 * Scope and no Layer MemoMap surround the statements. A later entry for one
 * key replaces an earlier one. Any other layers in the list are built once
 * around the services with `Effect.provide`, so an entry wins over a layer
 * that provides the same key.
 */
export const $provideEntries: {
  <const Layers extends [Layer.Any, ...Array<Layer.Any>]>(layers: Layers): <A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E | Layer.Error<Layers[number]>, Layer.Services<Layers[number]> | Exclude<R, Layer.Success<Layers[number]>>>
  <A, E, R, const Layers extends [Layer.Any, ...Array<Layer.Any>]>(
    self: Effect.Effect<A, E, R>,
    layers: Layers
  ): Effect.Effect<A, E | Layer.Error<Layers[number]>, Layer.Services<Layers[number]> | Exclude<R, Layer.Success<Layers[number]>>>
} = function(...args: Array<any>): any {
  return args.length === 1 ? (self: Effect.Effect<any, any, any>) => provideEntries(self, args[0]) : provideEntries(args[0], args[1])
}

function provideEntries(self: Effect.Effect<any, any, any>, layers: ReadonlyArray<Layer.Any>): Effect.Effect<any, any, any> {
  if (layers.length === 1) {
    const entry = entryOf(layers[0])
    if (entry !== undefined) {
      return Effect.provideService(self, entry.key, entry.value) // the common case, without a Context to build
    }
  }
  let services: Context.Context<any> | undefined
  let built: Array<Layer.Any> | undefined
  for (const layer of layers) {
    const entry = entryOf(layer)
    if (entry === undefined) {
      (built ??= []).push(layer)
    } else {
      services = services === undefined ? Context.make(entry.key, entry.value) : Context.add(services, entry.key, entry.value)
    }
  }
  const provided = services === undefined ? self : Effect.provideContext(self, services)
  return built === undefined ? provided : Effect.provide(provided, built as [Layer.Any, ...Array<Layer.Any>])
}

function entryOf(layer: Layer.Any): ServiceEntry | undefined {
  return (layer as any)[ServiceEntry]
}

/** The service key that `key` names: the key itself, or its export named `name`. */
type ProvidedKey<K, N extends string> = K extends Context.Key<any, any> ? K
  : K extends { readonly [P in N]: infer Key } ? Key
  : never
