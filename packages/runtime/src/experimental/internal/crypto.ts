// The experimental Crypto from Effect's Crypto in context (D313): one
// WebCrypto implementation, so every platform's layer is this one, provided
// with that platform's Effect Crypto.
import * as EffectCrypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Crypto from "../Crypto.js"

/** Provides the experimental Crypto from Effect's Crypto in context. */
export const layer: Layer.Layer<Crypto.Crypto, never, EffectCrypto.Crypto> = Layer.effect(
  Crypto.Crypto,
  Effect.map(Effect.service(EffectCrypto.Crypto), Crypto.make)
)
