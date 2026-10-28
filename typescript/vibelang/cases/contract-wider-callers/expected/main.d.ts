import { Effect } from "effect";
import { ServiceBrand } from "vibelang-runtime";
declare const Gone_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "Gone";
} & Readonly<A>;
declare class Gone extends Gone_base<{}> {
}
interface Needed extends Needed.Shape, ServiceBrand<"contract-wider-callers/main#Needed"> {
}
declare const Needed_base: import("vibelang-runtime").ServiceKey<Needed, Needed.Shape>;
declare abstract class Needed extends Needed_base {
}
declare namespace Needed {
    interface Shape {
        readonly id: string;
    }
}
export declare function longForm(): Effect.Effect<number, Gone, Needed>;
export declare function shortForm(): Effect.Effect<number, Gone, Needed>;
export declare function plain(): Effect.Effect<number>;
export declare function callerOfLong(): Effect.Effect<number, Gone, Needed>;
export declare function callerOfShort(): Effect.Effect<number, Gone, Needed>;
export declare function callerOfPlain(): Effect.Effect<number, never, never>;
export declare function callerOfMethod(): Effect.Effect<number, Gone, Needed>;
export declare function main(): Effect.Effect<number[], Gone, never>;
export {};
