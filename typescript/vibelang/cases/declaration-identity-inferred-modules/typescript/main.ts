import { Context, Data, Effect, Option, Schema, Scope, Tracer } from "effect"

export const fromString = Option.liftPredicate((s: string) => s.length > 0)

export const ModelID = Schema.String.pipe(Schema.brand("ModelID"))
export type ModelID = typeof ModelID.Type

export const withoutParentSpan = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>) =>
  effect.pipe(Effect.updateContext((context: Context.Context<Scope.Scope>) => Context.omit(Tracer.ParentSpan)(context)))

export class Gone extends Data.TaggedError("Gone")<{}> {}

export const pause = (ms: number) => Effect.sleep(ms)
