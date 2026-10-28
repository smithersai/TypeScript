// Compiles consumer/src/main.ts against out/main.d.ts and out/aliased.d.ts
// with skipLibCheck off, then runs what it exports.
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { Effect } from "effect"

const tsc = fileURLToPath(new URL("../../../built/local/tsc", import.meta.url))
const consumer = fileURLToPath(new URL("./consumer", import.meta.url))
execFileSync(tsc, ["-p", consumer, "--pretty", "false"], { stdio: "inherit" })
const { doubled, counted, failed } = await import("./consumer/out/main.js")
console.log(JSON.stringify(await Effect.runPromise(doubled)))
console.log(await Effect.runPromise(counted))
console.log(JSON.stringify(await Effect.runPromise(Effect.flip(failed))))
