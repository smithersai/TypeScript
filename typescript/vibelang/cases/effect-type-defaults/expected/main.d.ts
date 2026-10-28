import { Effect } from "effect";
import { ErrorBrand, ServiceBrand } from "vibelang-runtime";
declare const Gone_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "Gone";
} & Readonly<A>;
declare class Gone extends Gone_base<{
    readonly id: string;
}> {
    #private;
}
declare namespace Gone {
    type $error = ErrorBrand<"effect-type-defaults/main#Gone">;
}
interface Users extends Users.Shape, ServiceBrand<"effect-type-defaults/main#Users"> {
}
declare const Users_base: import("vibelang-runtime").ServiceKey<Users, Users.Shape>;
declare abstract class Users extends Users_base {
}
declare namespace Users {
    interface Shape {
        find(id: string): Effect.Effect<string, Gone>;
        count(): Effect.Effect<number>;
        all(): Effect.Effect<ReadonlyArray<string>, never, never>;
    }
}
export declare function plain(): Effect.Effect<number>;
export declare function failing(id: string): Effect.Effect<string, Gone>;
export declare function found(id: string): Effect.Effect<string, Gone, Users>;
export declare function guest(id: string): Effect.Effect<string, never, Users>;
export declare function inferred(id: string): Effect.Effect<string, Gone, Users>;
export declare function onlyErrors(id: string): Effect.Effect<string, Gone, never>;
export declare function partial(id: string): Effect.Effect<string, Gone, Users>;
export declare function run(program: Effect.Effect<number>): Effect.Effect<number>;
export declare function main(): Effect.Effect<{
    plain: number;
    failing: string;
    found: string;
    guest: string;
    inferred: string;
    onlyErrors: string;
    partial: string;
    count: number;
    all: readonly string[];
    ran: number;
}, Gone, never>;
export {};
