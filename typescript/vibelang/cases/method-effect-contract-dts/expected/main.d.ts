import { Context, Effect } from "effect";
declare const Count_base: Context.ServiceClass<Count, "method-effect-contract-dts/main#Count", {
    readonly n: number;
}>;
export declare class Count extends Count_base {
}
export interface CounterApi {
    count(): Effect.Effect<number>;
    read(): Effect.Effect<number, never, Count>;
    label(): string;
}
export declare class Counter {
    count(): Effect.Effect<number>;
    read(): Effect.Effect<number, never, Count>;
    label(): string;
}
export declare function total(): Effect.Effect<string, never, Count>;
export {};
