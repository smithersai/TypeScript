import { ServiceBrand } from "vibelang-runtime";
import { Effect, Layer } from "effect";
export interface User {
    readonly id: string;
    readonly name: string;
}
export interface Users extends Users.Shape, ServiceBrand<"vibelang-service-dts/main#Users"> {
}
declare const Users_base: import("vibelang-runtime").ServiceKey<Users, Users.Shape>;
export declare abstract class Users extends Users_base {
    static readonly layer: Layer.Layer<Users, never, never>;
}
export declare namespace Users {
    interface Shape {
        find(id: string): Effect.Effect<User, never, never>;
        readonly source: string;
    }
}
export interface Flags extends Flags.Shape, ServiceBrand<"vibelang-service-dts/main#Flags"> {
}
declare const Flags_base: import("vibelang-runtime").ReferenceKey<Flags.Shape>;
export declare abstract class Flags extends Flags_base {
    static readonly default: Flags.Shape;
}
export declare namespace Flags {
    interface Shape {
        readonly beta: boolean;
    }
}
export declare function greet(id: string): Effect.Effect<string, never, Users>;
