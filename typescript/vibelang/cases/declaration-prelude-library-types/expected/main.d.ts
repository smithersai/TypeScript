import { Context, Effect, Schema, SchemaAST, Types } from "effect";
export declare const done: (value: typeof Schema.Json.Type) => number;
export declare const decodeName: (input: unknown, options?: SchemaAST.ParseOptions) => Effect.Effect<string, Schema.SchemaError, never>;
export declare const makeContext: <I, S>(key: Context.Key<I, S>, service: Types.NoInfer<S>) => Context.Context<I>;
