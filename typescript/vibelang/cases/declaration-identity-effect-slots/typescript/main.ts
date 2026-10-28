import { Effect, Scope } from "effect"

export type Count = () => Effect.Effect<number>
export type Parse = (text: string) => Effect.Effect<number, TypeError>
export type Lookup = (key: string) => Effect.Effect<string, TypeError>
export type Scoped = Effect.Effect<string, never, Scope.Scope>
export type Explicit = Effect.Effect<number, never, never>

export function count(): Effect.Effect<number> {
  return Effect.succeed(3)
}

export function parse(text: string): Effect.Effect<number, TypeError> {
  const n = Number(text)
  return Number.isNaN(n) ? Effect.fail(new TypeError(text)) : Effect.succeed(n)
}

export const half = (n: number): Effect.Effect<number, RangeError> =>
  n % 2 === 1 ? Effect.fail(new RangeError("odd")) : Effect.succeed(n / 2)

export function within(): Effect.Effect<number, never, Scope.Scope> {
  return Effect.as(Effect.addFinalizer(() => Effect.void), 1)
}
