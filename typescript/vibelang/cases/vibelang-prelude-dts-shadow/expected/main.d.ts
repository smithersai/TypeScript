import { ServiceBrand } from "vibelang-runtime";
import { Effect, Layer } from "effect";
declare const Missing_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "Missing";
} & Readonly<A>;
export declare class Missing extends Missing_base<{
    readonly id: number;
}> {
}
export interface Names extends Names.Shape, ServiceBrand<"vibelang-prelude-dts-shadow/main#Names"> {
}
declare const Names_base: import("vibelang-runtime").ServiceKey<Names, Names.Shape>;
export declare abstract class Names extends Names_base {
}
export declare namespace Names {
    interface Shape {
        lookup(id: number): Effect.Effect<string, Missing, never>;
    }
}
export declare const NamesLive: Layer.Layer<Names, never, never>;
export declare function fallback(): Effect.Effect<string, never, never>;
export declare function greet(id: number): Effect.Effect<string, Missing, Names>;
export {};
