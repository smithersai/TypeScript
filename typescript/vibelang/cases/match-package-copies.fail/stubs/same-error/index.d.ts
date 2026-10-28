// The declarations of a compiled `export error NotFound { id: string }`.
import type { ErrorBrand } from "vibelang-runtime";
declare const NotFound_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "NotFound";
} & Readonly<A>;
export declare class NotFound extends NotFound_base<{
    readonly id: string;
}> {
    #private;
}
export declare namespace NotFound {
    type $error = ErrorBrand<"same-error/index#NotFound">;
}
