/**
 * The Bun layer of `Experimental.Crypto` (D313).
 *
 * @since 0.0.11
 */
import * as EffectBunCrypto from "@effect/platform-bun/BunCrypto"
import type * as EffectCrypto from "effect/Crypto"
import * as Layer from "effect/Layer"
import type * as Crypto from "../Crypto.js"
import * as CryptoExtension from "../internal/crypto.js"

/**
 * Provides `Experimental.Crypto` and Effect's `Crypto` from one
 * implementation: `@effect/platform-bun`'s, plus `hmac`, `sign` and
 * `verify` from WebCrypto.
 *
 * @since 0.0.11
 */
export const layer: Layer.Layer<Crypto.Crypto | EffectCrypto.Crypto> = Layer.provideMerge(
  CryptoExtension.layer,
  EffectBunCrypto.layer
)
