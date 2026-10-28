import { Effect, Scope } from "effect";
export { NotFound } from "./users.js";
export declare const one: Effect.Effect<number>;
export declare const scoped: Effect.Effect<void, never, Scope.Scope>;
export declare function main(): import("effect/Effect").Effect<string, import("./users.js").NotFound, never>;
