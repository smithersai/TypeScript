/**
 * The experimental `Process` service for Bun, over `process` and `node:os`,
 * which Bun implements as Node.js does.
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
