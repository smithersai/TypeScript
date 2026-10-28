/**
 * The file's header.
 */
import { Effect, Schema } from "effect";
/** The codes. */
export declare const Code: Schema.Literals<readonly ["a", "b"]>;
export type Code = typeof Code.Type;
/** A user. */
export declare const User: Schema.Struct<{
    /** The id. */
    readonly id: Schema.String;
    /** The nickname. */
    readonly nick: Schema.optional<Schema.String>;
    /** The address. */
    readonly home: Schema.Struct<{
        /** The city. */
        readonly city: Schema.String;
    }>;
}>;
export type User = typeof User.Type;
/** A name. */
export declare const Name: Schema.String;
export type Name = typeof Name.Type;
/** Nothing. */
export declare const Nothing: Schema.Null;
export type Nothing = typeof Nothing.Type;
/** After the schemas. */
export declare const after = 1;
export declare function main(): Effect.Effect<{
    code: "a" | "b";
    user: {
        readonly id: string;
        readonly nick?: string | undefined;
        readonly home: {
            readonly city: string;
        };
    };
}, Schema.SchemaError, never>;
