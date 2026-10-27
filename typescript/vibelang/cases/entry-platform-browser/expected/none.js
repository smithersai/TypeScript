import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as runtime from "vibelang-runtime";
import { BrowserRuntime as BrowserRuntime } from "@effect/platform-browser";
export function main() {
    return Effect.fnUntraced(function* main() {
        yield* Console.log("browser main ran");
    }).apply(this, arguments);
}
runtime.$entry(import.meta.main, import.meta.url, main, () => BrowserRuntime.runMain(main()));
