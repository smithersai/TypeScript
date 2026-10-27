export declare function inspect(dir: string): import("effect/Effect").Effect<{
    link: import("effect/FileSystem").File.Type;
    isLink: boolean;
    kind: import("effect/FileSystem").File.Type;
    followed: boolean;
    size: number;
    denied: "BadArgument" | import("effect/PlatformError").SystemErrorTag;
    mode: string;
    mac: string;
}, void | import("effect/PlatformError").PlatformError, import("vibelang-runtime/experimental/Crypto").Crypto | import("vibelang-runtime/experimental/FileSystem").FileSystem>;
export declare function main(): import("effect/Effect").Effect<{
    link: import("effect/FileSystem").File.Type;
    isLink: boolean;
    kind: import("effect/FileSystem").File.Type;
    followed: boolean;
    size: number;
    denied: "BadArgument" | import("effect/PlatformError").SystemErrorTag;
    mode: string;
    mac: string;
}, void | import("effect/PlatformError").PlatformError, never>;
