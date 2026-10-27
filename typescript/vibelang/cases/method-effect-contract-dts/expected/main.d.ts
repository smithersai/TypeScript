import { Effect } from "effect";
import { ServiceBrand } from "vibelang-runtime";
export interface Count extends Count.Shape, ServiceBrand<"method-effect-contract-dts/main#Count"> {
}
declare const Count_base: import("vibelang-runtime").ServiceKey<Count, Count.Shape>;
export declare abstract class Count extends Count_base {
}
export declare namespace Count {
    interface Shape {
        readonly n: number;
    }
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
