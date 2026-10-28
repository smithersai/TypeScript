import { Effect } from "effect";
import { ErrorBrand, ServiceBrand } from "vibelang-runtime";
declare const NotFound_base: new <A extends Record<string, any> = {}>(args: import("effect/Types").VoidIfEmpty<{ readonly [P in keyof A as P extends "_tag" ? never : P]: A[P]; }>) => import("effect/Cause").YieldableError & {
    readonly _tag: "NotFound";
} & Readonly<A>;
declare class NotFound extends NotFound_base<{
    readonly id: string;
}> {
    #private;
}
declare namespace NotFound {
    type $error = ErrorBrand<"contract-spellings-mixed/main#NotFound">;
}
interface Users extends Users.Shape, ServiceBrand<"contract-spellings-mixed/main#Users"> {
}
declare const Users_base: import("vibelang-runtime").ServiceKey<Users, Users.Shape>;
declare abstract class Users extends Users_base {
}
declare namespace Users {
    interface Shape {
        find(id: string): Effect.Effect<string, NotFound>;
        count(): Effect.Effect<number>;
    }
}
type Lookup = (id: string) => Effect.Effect<string, NotFound, Users>;
type Counted = Effect.Effect<number>;
export declare function terse(id: string): Effect.Effect<string, NotFound, Users>;
export declare function spelled(id: string): Effect.Effect<string, NotFound, Users>;
export declare function guest(lookup: Lookup, id: string): Effect.Effect<string, never, Users>;
export declare function add(program: Counted, extra: Effect.Effect<number>): Effect.Effect<number, never, Users>;
export declare function main(): Effect.Effect<{
    terse: string;
    spelled: string;
    guest: string;
    count: number;
    sum: number;
}, NotFound, never>;
export {};
