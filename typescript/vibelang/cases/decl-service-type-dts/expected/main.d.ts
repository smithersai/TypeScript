import { Effect, Layer } from "effect";
import { ServiceBrand } from "vibelang-runtime";
export interface SearchApi {
    find(query: string): Effect.Effect<string>;
}
export interface Search extends Search.Shape, ServiceBrand<"decl-service-type-dts/main#Search"> {
}
declare const Search_base: import("vibelang-runtime").ServiceKey<Search, Search.Shape>;
export declare abstract class Search extends Search_base {
    static readonly layer: Layer.Layer<Search, never, never>;
}
export declare namespace Search {
    type Shape = SearchApi;
}
export interface Prefix extends ServiceBrand<"decl-service-type-dts/main#Prefix"> {
}
declare const Prefix_base: import("vibelang-runtime").ServiceKey<Prefix, Prefix.Shape>;
export declare abstract class Prefix extends Prefix_base {
}
export declare namespace Prefix {
    type Shape = string;
}
export interface Version extends ServiceBrand<"decl-service-type-dts/main#Version"> {
}
declare const Version_base: import("vibelang-runtime").ReferenceKey<Version.Shape>;
export declare abstract class Version extends Version_base {
    static readonly default: number;
}
export declare namespace Version {
    type Shape = number;
}
export declare function greet(query: string): Effect.Effect<string, never, Prefix | Search>;
