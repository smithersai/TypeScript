import { Context, Schema, SchemaAST, Types } from "effect";
export declare const done: (value: typeof Schema.Json.Type) => number;
export declare const decodeName: (input: unknown, options?: SchemaAST.ParseOptions) => import("effect/Effect").Effect<string, import("effect/Schema").SchemaError, never>;
export declare const makeContext: <I, S>(key: import("effect/Context").Key<I, S>, service: Types.NoInfer<S>) => Context.Context<I>;
