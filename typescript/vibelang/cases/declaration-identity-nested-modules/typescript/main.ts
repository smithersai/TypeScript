import { Effect, Layer, Option, Scope } from "effect"
import { HttpClient, FetchHttpClient } from "effect/http"
export const layer: Layer.Layer<HttpClient.HttpClient> = Layer.provide(
  FetchHttpClient.layer,
  Layer.succeed(HttpClient.TracerPropagationEnabled, false),
)
export type Nested = Layer.Layer<Effect.Effect<Option.Option<string>, never, Scope.Scope>>
