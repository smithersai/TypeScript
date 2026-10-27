/**
 * The experimental `Locks` service for browsers, over `navigator.locks`:
 * shared by the tabs and workers of one origin, in a secure context.
 *
 * @experimental
 * @since 0.0.11
 */
import type * as Layer from "effect/Layer"
import * as internal from "../internal/locks.js"
import type { Locks } from "../Locks.js"

/**
 * @category layers
 * @since 0.0.11
 */
export const layer: Layer.Layer<Locks> = internal.layer
