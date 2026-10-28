import { Effect } from "effect";
export interface Count {
    readonly n: number;
    readonly "~vibelang/service"?: "method-effect-contract-dts/main#Count";
}
declare const Count_base: import("vibelang-runtime").ServiceKey<Count>;
export declare abstract class Count extends Count_base {
}
export interface CounterApi {
    count(): Effect.Effect<number, never, never>;
    read(): Effect.Effect<number, never, Count>;
    label(): string;
}
export declare class Counter {
    count(): Effect.Effect<number, never, never>;
    read(): Effect.Effect<number, never, Count>;
    label(): string;
}
export declare function total(): Effect.Effect<string, never, Count>;
