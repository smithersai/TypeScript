import { Effect } from "effect"
import { plusOne } from "../../out/aliased.js"
import { mapAll, twice } from "../../out/main.js"

let calls = 0
export const doubled = mapAll([1, 2], (n) => Effect.succeed(n * 2))
export const counted = twice(() => Effect.sync(() => ++calls))
export const failed = plusOne(() => Effect.fail("no"))
