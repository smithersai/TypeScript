/**
 * The experimental `Locks` service for Node.js, over Node.js's own Web Locks
 * (`navigator.locks`). They coordinate the main thread and the worker
 * threads of one process, never two processes, so `ExperimentalNodeServices.layer`
 * leaves them out: a program opts in with this layer.
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
