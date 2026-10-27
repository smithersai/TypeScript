/**
 * Node layers for the `Experimental` services (D313), beside
 * `@effect/platform-node`'s. A layer of a service that extends Effect's
 * provides the experimental service and Effect's service of the same name
 * from one implementation.
 *
 * @experimental
 * @since 0.0.11
 */
export * as NodeCrypto from "./NodeCrypto.js"
export * as NodeFileSystem from "./NodeFileSystem.js"
export * as NodeProcess from "./NodeProcess.js"
export * as NodeServices from "./NodeServices.js"
