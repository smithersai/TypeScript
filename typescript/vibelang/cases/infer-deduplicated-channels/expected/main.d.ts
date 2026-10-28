import { Effect } from "effect";
import { ErrorBrand, ServiceBrand } from "vibelang-runtime";
declare const Missing_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "Missing";
} & Readonly<A>;
export declare class Missing extends Missing_base<{}> {
    #private;
}
export declare namespace Missing {
    type $error = ErrorBrand<"infer-deduplicated-channels/main#Missing">;
}
export interface Need extends Need.Shape, ServiceBrand<"infer-deduplicated-channels/main#Need"> {
}
declare const Need_base: import("vibelang-runtime").ServiceKey<Need, Need.Shape>;
export declare abstract class Need extends Need_base {
}
export declare namespace Need {
    interface Shape {
        value(): Effect.Effect<number>;
    }
}
export declare function base(x: number): Effect.Effect<number, Missing, Need>;
export declare function twice(x: number): Effect.Effect<number, Missing, Need>;
export declare function contracted(x: number): Effect.Effect<number, Missing, Need>;
export declare class Chain {
    base(x: number): Effect.Effect<number, Missing, Need>;
    top(x: number): Effect.Effect<number, Missing, Need>;
}
export declare function main(): Effect.Effect<number, Missing, never>;
export {};
