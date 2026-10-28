// An error class as TypeScript declares a Data.TaggedError class, with a
// private member, as an older compiler wrote one.
declare const Expired_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "Expired";
} & Readonly<A>;
export declare class Expired extends Expired_base<{
    readonly at: number;
}> {
    #private;
}
export {};
