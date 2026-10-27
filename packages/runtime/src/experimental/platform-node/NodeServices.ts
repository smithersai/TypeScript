/**
 * The Node platform bundle with the `Experimental` services (D313).
 *
 * @since 0.0.11
 */
import * as EffectNodeServices from "@effect/platform-node/NodeServices"
import * as Layer from "effect/Layer"
import type * as Crypto from "../Crypto.js"
import type * as FileSystem from "../FileSystem.js"
import * as CryptoExtension from "../internal/crypto.js"
import * as FileSystemExtension from "../internal/nodeFileSystem.js"

/**
 * The services of `@effect/platform-node`'s `NodeServices` and the
 * experimental ones.
 *
 * @since 0.0.11
 */
export type NodeServices =
  | EffectNodeServices.NodeServices
  | Crypto.Crypto
  | FileSystem.FileSystem

/**
 * `@effect/platform-node`'s `NodeServices.layer` plus the experimental
 * services, each built on the Effect service of the same name in that
 * bundle, so Effect's own users of a service and the experimental one share
 * one implementation.
 *
 * @since 0.0.11
 */
export const layer: Layer.Layer<NodeServices> = Layer.provideMerge(
  Layer.mergeAll(
    CryptoExtension.layer,
    FileSystemExtension.layer
  ),
  EffectNodeServices.layer
)
