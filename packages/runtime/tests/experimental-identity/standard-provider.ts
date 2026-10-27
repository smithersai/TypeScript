// A program that needs the experimental Crypto (D313), provided with
// Effect's NodeServices.layer, which provides only Effect's Crypto. Stock
// TypeScript must reject the claim that nothing is left to provide:
// experimental-identity.test.ts expects exactly one error, at falselyClosed.
import * as NodeServices from "@effect/platform-node/NodeServices"
import * as Effect from "effect/Effect"
import type * as PlatformError from "effect/PlatformError"
import * as Redacted from "effect/Redacted"
import { Crypto } from "vibelang-runtime/experimental/Crypto"
import { ExperimentalNodeServices } from "vibelang-runtime/experimental/platform-node"

const needsExperimental = Effect.gen(function*() {
  const crypto = yield* Crypto
  return yield* crypto.hmac("SHA-256", Redacted.make(new Uint8Array([1])), new Uint8Array([2]))
})

export const falselyClosed: Effect.Effect<Uint8Array, PlatformError.PlatformError, never> =
  Effect.provide(needsExperimental, NodeServices.layer)

// The experimental bundle provides it.
export const closed: Effect.Effect<Uint8Array, PlatformError.PlatformError, never> =
  Effect.provide(needsExperimental, ExperimentalNodeServices.layer)
