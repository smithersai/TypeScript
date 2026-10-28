import { Effect, Layer, Schema, Scope } from "effect"

export type Scoped = Effect.Effect<string, Error, Scope.Scope>
export type Task = Effect.Effect<number, Error>
export type Run = (scope: Scope.Scope) => Effect.Effect<void, never, Scope.Scope>
export type Settings = Schema.Schema<number>
export type Wiring = Layer.Layer<Scope.Scope>
