/**
 * The file overview stays first in the declaration file, above the prelude
 * types and the callback contracts that declaration emit writes.
 *
 * @since 0.1.0
 */
import { Effect, Layer } from "effect";
export declare const layer: Layer.Layer<never>;
export declare function mapAll<A, B, E = never, R = never>(items: ReadonlyArray<A>, f: (a: A) => Effect<B, E, R>): Effect.Effect<B[], E, R>;
export declare const size: number;
export declare function main(): Effect.Effect<number, never, never>;
