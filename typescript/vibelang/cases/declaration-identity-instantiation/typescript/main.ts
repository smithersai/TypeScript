import { Effect, Scope, identity } from "effect"

export const idE = identity<Effect.Effect<number>>
export const idS = identity<Scope.Scope>
