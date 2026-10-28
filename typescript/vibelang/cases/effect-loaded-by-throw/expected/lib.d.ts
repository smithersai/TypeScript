import { Effect } from "effect";
export declare const make: (name: string) => Effect.Effect<{
    name: string;
}, TypeError, never>;
export declare const pick: (name: string) => Effect.Effect<string, TypeError, never>;
export declare const count: () => import("effect/Stream").Stream<number, never, never>;
