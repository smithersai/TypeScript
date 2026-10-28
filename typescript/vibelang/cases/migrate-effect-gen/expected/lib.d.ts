import { Effect, Layer } from "effect";
import { Gone, Users } from "./services.js";
export declare const greet: (id: string) => Effect.Effect<string, never, Users>;
export declare function count(n: number): Effect.Effect<number, never, never>;
export declare class Box {
    readonly value: number;
    constructor(value: number);
    doubled(): Effect.Effect<number, never, never>;
}
export declare const check: (n: number) => Effect.Effect<string, Gone, never>;
export declare const doubleAll: (xs: ReadonlyArray<number>) => Effect.Effect<number[], never, never>;
export declare const describe: (program: Effect.Effect<number>) => Effect.Effect<string, never, never>;
export declare const UsersLive: Layer.Layer<Users, never, never>;
