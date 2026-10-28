import { Effect } from "effect";
import { $ErrorArgs } from "vibelang-runtime";
declare const AppError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: string;
} & Readonly<A>;
/** The base of a family: each subclass carries its own tag. */
export declare class AppError extends AppError_base<{
    readonly _tag: string;
    readonly code: string;
}> {
    #private;
    static readonly family = "app";
}
declare const NotFound_base: typeof AppError;
export declare class NotFound extends NotFound_base {
    #private;
    readonly _tag: "NotFound";
    readonly path: string;
    constructor(args: $ErrorArgs<typeof AppError, Pick<NotFound, "path">>);
}
declare const Timeout_base: typeof AppError;
export declare class Timeout extends Timeout_base {
    #private;
    readonly _tag: "Timeout";
}
declare const Typed_base: typeof AppError;
export declare class Typed<T extends string> extends Typed_base {
    #private;
    readonly _tag: "Typed";
    readonly value: T;
    constructor(args: $ErrorArgs<typeof AppError, Pick<Typed<T>, "value">>);
}
declare const HttpError_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: string;
} & Readonly<A>;
/** An abstract error has a family's tag type without a _tag field. */
export declare abstract class HttpError extends HttpError_base<{
    readonly status: number;
}> {
    #private;
    abstract describe(): string;
}
declare const Missing_base: typeof HttpError;
export declare class Missing extends Missing_base {
    #private;
    readonly _tag: "Missing";
    describe(): string;
}
declare const Gone_base: typeof HttpError;
export declare class Gone extends Gone_base {
    #private;
    readonly _tag: "Gone";
    describe(): string;
}
export declare function main(): Effect.Effect<{
    tags: string[];
    names: string[];
    family: boolean[];
    notFoundIsTimeout: boolean;
    routed: string[];
    base: string;
    classified: string[];
    typed: string;
    static: string;
    describe: string;
    abstract: boolean;
    gone: string;
}, never, never>;
export {};
