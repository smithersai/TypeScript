/**
 * The Node layer of `Experimental.FileSystem` (D313).
 *
 * @since 0.0.11
 */
import * as EffectNodeFileSystem from "@effect/platform-node/NodeFileSystem"
import type * as EffectFileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import type * as FileSystem from "../FileSystem.js"
import * as FileSystemExtension from "../internal/nodeFileSystem.js"

/**
 * Provides `Experimental.FileSystem` and Effect's `FileSystem` from one
 * implementation: `@effect/platform-node`'s, plus `lstat`, `access` with
 * `executable`, `open` with `nonBlocking` and `File.chmod`.
 *
 * @since 0.0.11
 */
export const layer: Layer.Layer<FileSystem.FileSystem | EffectFileSystem.FileSystem> = Layer.provideMerge(
  FileSystemExtension.layer,
  EffectNodeFileSystem.layer
)
