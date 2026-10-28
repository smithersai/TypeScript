import { Effect } from "effect";
export declare function one(version: string): Effect.Effect<string, never, never>;
export declare function two(version: string): Effect.Effect<string, never, never>;
export declare function three(version: string): Effect.Effect<"no" | "stopped" | "yes", never, never>;
export declare function main(): Effect.Effect<{
    one: string;
    two: string;
    three: string;
}, never, never>;
