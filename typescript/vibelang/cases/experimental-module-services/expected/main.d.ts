import { Effect, Redacted } from "effect";
import { Experimental } from "vibelang-runtime";
export declare function alive(process: Experimental.Process.Process, pid: number): Effect.Effect<boolean, import("effect/PlatformError").PlatformError, never>;
export declare function faked(): Effect.Effect<import("vibelang-runtime/experimental/Process").Platform, never, never>;
export declare function mac(key: Redacted.Redacted<Uint8Array>, data: Uint8Array): Effect.Effect<Uint8Array<ArrayBufferLike>, import("effect/PlatformError").PlatformError, import("vibelang-runtime/experimental/Crypto").Crypto>;
export declare function executable(path: string): Effect.Effect<void, import("effect/PlatformError").PlatformError, import("vibelang-runtime/experimental/FileSystem").FileSystem>;
export declare function lock(name: string): Effect.Effect<import("vibelang-runtime/experimental/Locks").Held, import("effect/PlatformError").PlatformError, import("vibelang-runtime/experimental/Locks").Locks | import("effect/Scope").Scope>;
export declare function main(): Effect.Effect<{
    same: boolean;
    positive: boolean;
    running: boolean;
    host: boolean;
    alive: boolean;
    faked: import("vibelang-runtime/experimental/Process").Platform;
    mac: string;
}, import("effect/PlatformError").PlatformError, never>;
