/**
 * The browser bundle of the `Experimental` services (D313).
 * `@effect/platform-browser` has no bundle of its own; a browser has no
 * file system and no process to read, so no `FileSystem` or `Process`
 * layer.
 *
 * @experimental
 * @since 0.0.11
 */
import type * as EffectCrypto from "effect/Crypto"
import * as Layer from "effect/Layer"
import type * as Crypto from "../Crypto.js"
import type * as Locks from "../Locks.js"
import * as BrowserCrypto from "./BrowserCrypto.js"
import * as BrowserLocks from "./BrowserLocks.js"

/**
 * The services of the browser bundle: the experimental `Crypto` with
 * Effect's, and `Locks`.
 *
 * @since 0.0.11
 */
export type BrowserServices = Crypto.Crypto | EffectCrypto.Crypto | Locks.Locks

/**
 * `BrowserCrypto.layer`, which provides the experimental `Crypto` and
 * Effect's from `@effect/platform-browser`'s, and `BrowserLocks.layer`.
 *
 * @category layers
 * @since 0.0.11
 */
export const layer: Layer.Layer<BrowserServices> = Layer.mergeAll(BrowserCrypto.layer, BrowserLocks.layer)
