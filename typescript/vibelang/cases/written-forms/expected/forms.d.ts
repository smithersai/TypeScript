import { Effect } from "effect";
export declare function bump(): Effect.Effect<number, never, never>;
export declare const arrow: (n: number) => Effect.Effect<number, never, never>;
export declare const api: {
    triple(n: number): Effect.Effect<number, never, never>;
};
export declare function double(n: number): number;
export declare const half: (n: number) => number;
export declare function makeApi(): {
    half(n: number): number;
    nested: {
        third(n: number): number;
    };
};
export declare const initial: number;
export declare const halves: number[];
export declare const doubled: number[];
export declare const madeHalf: number;
export declare const madeThird: number;
export declare const label: {
    toString(): string;
    toJSON: () => number;
};
export declare function main(): Effect.Effect<number[], never, never>;
