// Compile a consumer of the experimental exports (D313) against the emitted .d.ts files.
import * as EffectCrypto from "effect/Crypto"
import * as EffectNodeServices from "@effect/platform-node/NodeServices"
import * as Effect from "effect/Effect"
import * as EffectFileSystem from "effect/FileSystem"
import type * as Layer from "effect/Layer"
import type * as PlatformError from "effect/PlatformError"
import * as Redacted from "effect/Redacted"
import type * as Scope from "effect/Scope"
import { Experimental } from "vibelang-runtime"
import { Crypto, FileSystem } from "vibelang-runtime/experimental"
import * as CryptoModule from "vibelang-runtime/experimental/Crypto"
import * as FileSystemModule from "vibelang-runtime/experimental/FileSystem"
import { BrowserCrypto } from "vibelang-runtime/experimental/platform-browser"
import { BunCrypto, BunFileSystem, BunServices } from "vibelang-runtime/experimental/platform-bun"
import { NodeCrypto, NodeFileSystem, NodeServices } from "vibelang-runtime/experimental/platform-node"

// The aggregate, the subpaths and the prelude's namespace are one module each.
const sameFileSystem: typeof FileSystemModule = Experimental.FileSystem
const sameCrypto: typeof CryptoModule = Crypto
void [sameFileSystem, sameCrypto]

// The experimental implementations are supersets of Effect's.
const asEffectFileSystem = (fs: FileSystem.Service): EffectFileSystem.FileSystem => fs
const asEffectFile = (file: FileSystem.File): EffectFileSystem.File => file
const asEffectCrypto = (crypto: Crypto.Service): EffectCrypto.Crypto => crypto
// @ts-expect-error Effect's service lacks the experimental members.
const notExperimental = (fs: EffectFileSystem.FileSystem): FileSystem.Service => fs
void [asEffectFileSystem, asEffectFile, asEffectCrypto, notExperimental]

const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const info: EffectFileSystem.File.Info = yield* fs.lstat("link")
  yield* fs.access("tool", { executable: true })
  const file: FileSystem.File = yield* fs.open("file", { noFollow: true, nonBlocking: true })
  yield* file.chmod(0o600)
  const crypto = yield* Crypto.Crypto
  const mac: Uint8Array = yield* crypto.hmac("SHA-256", Redacted.make(new Uint8Array(32)), new Uint8Array())
  const signature: Uint8Array = yield* crypto.sign("Ed25519", Redacted.make(new Uint8Array()), mac)
  const valid: boolean = yield* crypto.verify("ECDSA-P256-SHA256", new Uint8Array(), signature, mac)
  return [info, valid] as const
})
const needs: Effect.Effect<readonly [EffectFileSystem.File.Info, boolean], PlatformError.PlatformError, FileSystem.FileSystem | Crypto.Crypto | Scope.Scope> = program
void needs
// @ts-expect-error A secret key must be Redacted.
Effect.flatMap(Crypto.Crypto.asEffect(), (crypto) => crypto.hmac("SHA-256", new Uint8Array(), new Uint8Array()))
// @ts-expect-error Only the two signature algorithms are accepted.
Effect.flatMap(Crypto.Crypto.asEffect(), (crypto) => crypto.sign("RSA", Redacted.make(new Uint8Array()), new Uint8Array()))

// Each platform layer provides the experimental service and Effect's.
const layers: ReadonlyArray<Layer.Layer<FileSystem.FileSystem | EffectFileSystem.FileSystem>> = [
  NodeFileSystem.layer, BunFileSystem.layer, FileSystem.layerNoop({})
]
const cryptoLayers: ReadonlyArray<Layer.Layer<Crypto.Crypto | EffectCrypto.Crypto>> = [
  NodeCrypto.layer, BunCrypto.layer, BrowserCrypto.layer, Crypto.layerTest()
]
const bundles: ReadonlyArray<Layer.Layer<NodeServices.NodeServices | BunServices.BunServices>> = [NodeServices.layer, BunServices.layer]
const run: Effect.Effect<readonly [EffectFileSystem.File.Info, boolean], PlatformError.PlatformError> = Effect.scoped(Effect.provide(program, NodeServices.layer))
void [layers, cryptoLayers, bundles, run]

// The experimental requirements have identities of their own: Effect's
// bundle provides Effect's FileSystem and Crypto, which leaves them.
type Requirements<T> = T extends Effect.Effect<infer _A, infer _E, infer R> ? R : never
type Same<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false
const leftByEffect = Effect.provide(program, EffectNodeServices.layer)
const left: Same<Requirements<typeof leftByEffect>, FileSystem.FileSystem | Crypto.Crypto | Scope.Scope> = true
void left
