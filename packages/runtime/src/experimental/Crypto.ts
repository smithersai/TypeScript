/**
 * Experimental: Effect's `Crypto` service plus `hmac`, `sign` and `verify`
 * (D313).
 *
 * The service has its own key and a superset of Effect's interface. One
 * WebCrypto implementation (`crypto.subtle`, which Node, Bun, Deno, browsers
 * and Workers all have) serves every platform; the layers in
 * `vibelang-runtime/experimental/platform-node`, `-bun` and `-browser`
 * provide it and Effect's `Crypto` from one implementation. Secret keys are
 * `Redacted`, so logs and errors never print them. When Effect releases these
 * members, this module re-exports Effect's.
 *
 * @since 0.0.11
 */
import * as Context from "effect/Context"
import * as EffectCrypto from "effect/Crypto"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/PlatformError"
import * as Redacted from "effect/Redacted"

/**
 * A signature algorithm. `"ECDSA-P256-SHA256"` is ECDSA on the P-256 curve
 * with SHA-256, whose signatures are the 64 bytes r‖s that WebCrypto writes
 * (not DER). `"Ed25519"` signatures are 64 bytes.
 *
 * @since 0.0.11
 */
export type SignatureAlgorithm = "ECDSA-P256-SHA256" | "Ed25519"

/**
 * Effect's `Crypto` plus `hmac`, `sign` and `verify`.
 *
 * @since 0.0.11
 */
export interface Crypto extends EffectCrypto.Crypto {
  /**
   * Computes the HMAC of `data` under `key`, the raw secret bytes.
   */
  hmac(
    algorithm: EffectCrypto.DigestAlgorithm,
    key: Redacted.Redacted<Uint8Array>,
    data: Uint8Array
  ): Effect.Effect<Uint8Array, PlatformError.PlatformError>

  /**
   * Signs `data` with `privateKey`, a PKCS#8 DER private key. A key that is
   * not one for `algorithm` fails with `BadArgument`.
   */
  sign(
    algorithm: SignatureAlgorithm,
    privateKey: Redacted.Redacted<Uint8Array>,
    data: Uint8Array
  ): Effect.Effect<Uint8Array, PlatformError.PlatformError>

  /**
   * Reports whether `signature` signs `data` under `publicKey`, an SPKI DER
   * public key: `false` for a signature that does not match. A key that is
   * not one for `algorithm` fails with `BadArgument`.
   */
  verify(
    algorithm: SignatureAlgorithm,
    publicKey: Uint8Array,
    signature: Uint8Array,
    data: Uint8Array
  ): Effect.Effect<boolean, PlatformError.PlatformError>
}

/**
 * The service key, distinct from Effect's `Crypto.Crypto`.
 *
 * @since 0.0.11
 */
export const Crypto: Context.Service<Crypto, Crypto> = /* @__PURE__ */ Context.Service(
  "vibelang/experimental/Crypto"
)

const signatureAlgorithms = {
  "ECDSA-P256-SHA256": { key: { name: "ECDSA", namedCurve: "P-256" }, sign: { name: "ECDSA", hash: "SHA-256" } },
  "Ed25519": { key: { name: "Ed25519" }, sign: { name: "Ed25519" } }
} satisfies Record<SignatureAlgorithm, { readonly key: EcKeyImportParams | Algorithm; readonly sign: EcdsaParams | Algorithm }>

const keyFormats = { raw: "a raw", pkcs8: "a PKCS#8 private", spki: "an SPKI public" }

// WebCrypto accepts only ArrayBuffer-backed bytes, so each input is copied.
const bytes = (data: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(data)

const unavailable = (method: string) =>
  Effect.fail(PlatformError.systemError({
    module: "Crypto",
    method,
    _tag: "Unknown",
    description: "crypto.subtle is not available"
  }))

// Runs a WebCrypto operation; a rejection is an Unknown system error.
const subtleCall = <A>(
  subtle: SubtleCrypto | undefined,
  method: string,
  operation: (subtle: SubtleCrypto) => Promise<A>
): Effect.Effect<A, PlatformError.PlatformError> =>
  subtle === undefined ? unavailable(method) : Effect.tryPromise({
    try: () => operation(subtle),
    catch: (cause) =>
      PlatformError.systemError({ module: "Crypto", method, _tag: "Unknown", description: `could not ${method}`, cause })
  })

// Imports a key for one use. Bytes that are not a key of the format and
// algorithm fail with BadArgument, which names neither the bytes nor the key.
const importKey = (
  subtle: SubtleCrypto | undefined,
  method: string,
  format: keyof typeof keyFormats,
  key: Uint8Array,
  algorithm: HmacImportParams | EcKeyImportParams | Algorithm,
  usage: KeyUsage
): Effect.Effect<CryptoKey, PlatformError.PlatformError> =>
  subtle === undefined ? unavailable(method) : Effect.tryPromise({
    try: () => subtle.importKey(format, bytes(key), algorithm, false, [usage]),
    catch: (cause) =>
      PlatformError.badArgument({
        module: "Crypto",
        method,
        description: `the key is not ${keyFormats[format]} key for ${algorithm.name}`,
        cause
      })
  })

/**
 * Extends an Effect `Crypto` with `hmac`, `sign` and `verify` from the
 * platform's WebCrypto, the `globalThis.crypto.subtle` of the moment `make`
 * runs. Without WebCrypto they fail with `Unknown`, as Effect's browser
 * `digest` does.
 *
 * @since 0.0.11
 */
export const make = (crypto: EffectCrypto.Crypto): Crypto => {
  const subtle: SubtleCrypto | undefined = globalThis.crypto?.subtle
  return Crypto.of({
    ...crypto,
    hmac: (algorithm, key, data) =>
      Effect.flatMap(
        importKey(subtle, "hmac", "raw", Redacted.value(key), { name: "HMAC", hash: algorithm }, "sign"),
        (secret) => subtleCall(subtle, "hmac", async (subtle) => new Uint8Array(await subtle.sign("HMAC", secret, bytes(data))))
      ),
    sign: (algorithm, privateKey, data) =>
      Effect.flatMap(
        importKey(subtle, "sign", "pkcs8", Redacted.value(privateKey), signatureAlgorithms[algorithm].key, "sign"),
        (secret) =>
          subtleCall(subtle, "sign", async (subtle) =>
            new Uint8Array(await subtle.sign(signatureAlgorithms[algorithm].sign, secret, bytes(data))))
      ),
    verify: (algorithm, publicKey, signature, data) =>
      Effect.flatMap(
        importKey(subtle, "verify", "spki", publicKey, signatureAlgorithms[algorithm].key, "verify"),
        (key) =>
          subtleCall(subtle, "verify", (subtle) =>
            subtle.verify(signatureAlgorithms[algorithm].sign, key, bytes(signature), bytes(data)))
      )
  })
}

/**
 * A deterministic `Crypto` for tests that provides this service and Effect's
 * `Crypto`: random bytes are zeros, so UUIDs and shuffles repeat; digests,
 * HMACs and signatures come from WebCrypto; `crypto` replaces any member.
 *
 * @since 0.0.11
 */
export const layerTest = (crypto: Partial<Crypto> = {}): Layer.Layer<Crypto | EffectCrypto.Crypto> => {
  const test = Crypto.of({
    ...make(EffectCrypto.make({
      randomBytes: (size) => new Uint8Array(size),
      digest: (algorithm, data) =>
        subtleCall(globalThis.crypto?.subtle, "digest", async (subtle) =>
          new Uint8Array(await subtle.digest(algorithm, bytes(data))))
    })),
    ...crypto
  })
  return Layer.mergeAll(Layer.succeed(Crypto, test), Layer.succeed(EffectCrypto.Crypto, test))
}
