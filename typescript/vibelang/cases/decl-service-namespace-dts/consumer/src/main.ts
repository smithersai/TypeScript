// TypeScript code that provides services declared inside namespaces through
// their declarations.
import { Effect, Layer } from "effect"
import { greet, N, Outer } from "../../out/main.js"

const users = Layer.succeed(N.Users, { name: "Ada" })
const clock = Layer.succeed(Outer.Inner.Clock, { now: () => Effect.succeed(42) })
export const greeted: Effect.Effect<string, never, never> = Effect.provide(greet(), Layer.mergeAll(users, clock))
