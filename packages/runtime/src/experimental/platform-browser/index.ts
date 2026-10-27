/**
 * Browser layers for the `Experimental` services (D313), beside
 * `@effect/platform-browser`'s. Browsers have no file system layer, as in
 * Effect, and no process to read, so no `Process` layer.
 *
 * @experimental
 * @since 0.0.11
 */
export * as BrowserCrypto from "./BrowserCrypto.js"
export * as BrowserLocks from "./BrowserLocks.js"
export * as BrowserServices from "./BrowserServices.js"
