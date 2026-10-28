import { FileSystem } from "effect";
export declare function exists(fs: FileSystem.FileSystem, path: string): import("effect/Effect").Effect<boolean, import("effect/PlatformError").PlatformError, never>;
export declare function read(path: string): import("effect/Effect").Effect<string, import("effect/PlatformError").PlatformError, import("effect/FileSystem").FileSystem>;
export declare const id: () => import("effect/Effect").Effect<string, import("effect/PlatformError").PlatformError, import("effect/Crypto").Crypto>;
export declare const token: () => import("effect/Effect").Effect<Uint8Array<ArrayBufferLike>, import("effect/PlatformError").PlatformError, import("effect/Crypto").Crypto>;
export declare const status: () => import("effect/Effect").Effect<string, import("effect/PlatformError").PlatformError, import("effect/process/ChildProcessSpawner").ChildProcessSpawner>;
export declare const line: () => import("effect/Effect").Effect<string, import("effect/Terminal").QuitError, import("effect/Terminal").Terminal>;
export declare function main(): import("effect/Effect").Effect<(string | boolean | readonly string[])[], import("effect/PlatformError").PlatformError, never>;
