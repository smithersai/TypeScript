/**
 * The file's header.
 */
import { Effect, Schema } from "effect";
/** The codes. */
export type Code = typeof Code.Type;
/** The codes. */
export declare const Code: Schema.Literals<readonly ["a", "b"]>;
/** A user. */
export interface User extends Schema.Schema.Type<typeof User> {
}
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
/** A name. */
export type Name = typeof Name.Type;
/** A name. */
export declare const Name: Schema.String;
/** Nothing. */
export type Nothing = typeof Nothing.Type;
/** Nothing. */
export declare const Nothing: Schema.Null;
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
