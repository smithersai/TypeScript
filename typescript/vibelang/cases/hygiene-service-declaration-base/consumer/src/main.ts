// TypeScript code that imports a service and a constant spelled like the
// service's key base through their declarations.
import { Effect } from "effect"
import { name, Users, Users_base } from "../../out/main.js"

export const base: number = Users_base
export const program: Effect.Effect<string, never, never> = Effect.provideService(name(), Users, { name: "consumer" })
