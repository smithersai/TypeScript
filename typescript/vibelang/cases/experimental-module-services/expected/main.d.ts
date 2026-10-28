import { Redacted } from "effect";
import { Experimental } from "vibelang-runtime";
export declare function alive(process: Experimental.Process.Process, pid: number): import("effect/Effect").Effect<boolean, import("effect/PlatformError").PlatformError, never>;
export declare function faked(): import("effect/Effect").Effect<import("vibelang-runtime/experimental/Process").Platform, never, never>;
export declare function mac(key: Redacted.Redacted<Uint8Array>, data: Uint8Array): import("effect/Effect").Effect<Uint8Array<ArrayBufferLike>, import("effect/PlatformError").PlatformError, import("vibelang-runtime/experimental/Crypto").Crypto>;
export declare function executable(path: string): import("effect/Effect").Effect<void, import("effect/PlatformError").PlatformError, import("vibelang-runtime/experimental/FileSystem").FileSystem>;
export declare function lock(name: string): import("effect/Effect").Effect<import("vibelang-runtime/experimental/Locks").Held, import("effect/PlatformError").PlatformError, import("vibelang-runtime/experimental/Locks").Locks | import("effect/Scope").Scope>;
export declare function main(): import("effect/Effect").Effect<{
    same: boolean;
    positive: boolean;
    running: boolean;
    host: boolean;
    alive: boolean;
    faked: import("vibelang-runtime/experimental/Process").Platform;
    mac: string;
}, import("effect/PlatformError").PlatformError, never>;
