// TypeScript code that provides a service through its declaration, beside a
// constant spelled like the service's key base.
import { Effect } from "effect"
import { read, S, S_base } from "../../out/main.js"

export const base: number = S_base
export const program: Effect.Effect<string, never, never> = Effect.provideService(read(), S, { value: "consumer" })
