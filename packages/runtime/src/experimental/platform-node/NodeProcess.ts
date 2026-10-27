/**
 * The experimental `Process` service for Node.js, over `process` and
 * `node:os`.
 *
 * @experimental
 * @since 0.0.11
 */
import type * as Layer from "effect/Layer"
import * as internal from "../internal/process.js"
import type { Process } from "../Process.js"

/**
 * @category layers
 * @since 0.0.11
 */
export const layer: Layer.Layer<Process> = internal.layer
