import type { Experimental } from "vibelang-runtime";
import { FileSystem } from "vibelang-runtime/experimental/FileSystem";
export declare function isLink(path: string): import("effect/Effect").Effect<boolean, import("effect/PlatformError").PlatformError, FileSystem>;
export declare function size(path: string): import("effect/Effect").Effect<import("effect/ByteSize").ByteSize, import("effect/PlatformError").PlatformError, FileSystem>;
export declare function kind(fs: Experimental.FileSystem.FileSystem, path: string): import("effect/Effect").Effect<import("effect/FileSystem").File.Type, import("effect/PlatformError").PlatformError, never>;
