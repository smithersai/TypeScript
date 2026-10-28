import { Effect } from "effect";
import { ErrorBrand } from "vibelang-runtime";
declare const Failure_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: string;
} & Readonly<A>;
export declare class Failure extends Failure_base<{
    readonly _tag: string;
    readonly code: string;
    readonly summary: string;
}> {
    #private;
    constructor(code: string, summary: string);
    toJSON(): Record<string, unknown>;
}
export declare namespace Failure {
    type $error = ErrorBrand<"decl-error-positional/main#Failure">;
}
declare const Integration_base: typeof Failure;
export declare class Integration extends Integration_base {
    #private;
    readonly _tag: "Integration";
    readonly reason: string;
    constructor(reason: string, summary: string);
}
export declare namespace Integration {
    type $error = ErrorBrand<"decl-error-positional/main#Integration">;
}
declare const Plain_base: typeof Failure;
export declare class Plain extends Plain_base {
    #private;
    readonly _tag: "Plain";
}
export declare namespace Plain {
    type $error = ErrorBrand<"decl-error-positional/main#Plain">;
}
export declare function main(): Effect.Effect<{
    failure: {
        tag: string;
        summary: string;
    };
    integration: {
        tag: "Integration";
        code: string;
        reason: string;
        summary: string;
    };
    plain: {
        tag: "Plain";
        code: string;
        summary: string;
    };
    keys: string[];
    routed: string[];
    base: string;
}, never, never>;
export {};
