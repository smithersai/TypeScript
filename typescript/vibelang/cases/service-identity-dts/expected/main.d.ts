import { Effect, Layer } from "effect";
import { ServiceBrand } from "vibelang-runtime";
export interface User {
    readonly id: string;
    readonly name: string;
}
export interface Users extends Users.Shape, ServiceBrand<"service-identity-dts/main#Users"> {
}
declare const Users_base: import("vibelang-runtime").ServiceKey<Users, Users.Shape>;
export declare abstract class Users extends Users_base {
    static readonly layer: Layer.Layer<Users, never, never>;
}
export declare namespace Users {
    interface Shape {
        find(id: string): Effect.Effect<User>;
        readonly source: string;
    }
}
export interface Flags extends Flags.Shape, ServiceBrand<"service-identity-dts/main#Flags"> {
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
export interface SearchApi {
    find(query: string): Effect.Effect<string>;
}
export interface Search extends Search.Shape, ServiceBrand<"service-identity-dts/main#Search"> {
}
declare const Search_base: import("vibelang-runtime").ServiceKey<Search, Search.Shape>;
export declare abstract class Search extends Search_base {
}
export declare namespace Search {
    type Shape = SearchApi;
}
export interface Prefix extends ServiceBrand<"service-identity-dts/main#Prefix"> {
}
declare const Prefix_base: import("vibelang-runtime").ServiceKey<Prefix, Prefix.Shape>;
export declare abstract class Prefix extends Prefix_base {
}
export declare namespace Prefix {
    type Shape = string;
}
export interface Shape {
    readonly sides: number;
}
interface Geometry_Shape {
    area(shape: Shape): Effect.Effect<number>;
}
export interface Geometry extends Geometry.Shape, ServiceBrand<"service-identity-dts/main#Geometry"> {
}
declare const Geometry_base: import("vibelang-runtime").ServiceKey<Geometry, Geometry.Shape>;
export declare abstract class Geometry extends Geometry_base {
}
export declare namespace Geometry {
    type Shape = Geometry_Shape;
}
export declare class UsersInMemory implements Users.Shape {
    readonly source = "in-memory";
    find(id: string): Effect.Effect<{
        id: string;
        name: string;
    }, never, never>;
}
export declare function sourceOf(users: Users.Shape): Effect.Effect<string, never, never>;
export declare function current(): Effect.Effect<Users, never, Users>;
export declare function greet(id: string): Effect.Effect<string, never, Users>;
