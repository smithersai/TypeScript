// TypeScript code that calls the methods through main.vibe's declarations.
import { Effect, Layer } from "effect"
import { Count, Counter, total, type CounterApi } from "../../out/main.js"

const counter: CounterApi = new Counter()
const layer = Layer.succeed(Count, { n: 1 })
export const label: string = counter.label()
export const counted: Effect.Effect<number, never, never> = counter.count()
export const read: Effect.Effect<number, never, never> = Effect.provide(counter.read(), layer)
export const viaVibe: Effect.Effect<string, never, never> = Effect.provide(total(), layer)
