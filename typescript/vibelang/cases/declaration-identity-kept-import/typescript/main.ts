import { Array, Effect } from "effect"

export const size = (xs: Array.NonEmptyReadonlyArray<number>): Effect.Effect<number> => Effect.succeed(xs.length)
