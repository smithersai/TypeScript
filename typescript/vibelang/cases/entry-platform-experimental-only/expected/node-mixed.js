import * as Console from "effect/Console";
import * as FileSystem from "effect/FileSystem";
import { Experimental } from "vibelang-runtime";
import * as Effect from "effect/Effect";
import * as runtime from "vibelang-runtime";
import { ExperimentalNodeServices as ExperimentalNodeServices } from "vibelang-runtime/experimental/platform-node";
import { NodeRuntime as NodeRuntime } from "@effect/platform-node";
export function main() {
    return Effect.fnUntraced(function* main() {
        const pid = yield* (yield* Experimental.Process.Process).pid;
        yield* Console.log(`node mixed ${yield* (yield* FileSystem.FileSystem).exists("package.json")} ${pid > 0}`);
    }).apply(this, arguments);
}
runtime.$entry(import.meta.main, import.meta.url, main, () => NodeRuntime.runMain(Effect.provide(main(), ExperimentalNodeServices.layer)));
