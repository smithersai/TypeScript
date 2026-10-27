import { Effect } from "effect"
import { Box, Crate } from "./box.vibe"

for (const box of [new Box(), new Crate()]) {
  console.log(Effect.runSync(box.fast()), Effect.runSync(box.slow()), Effect.runSync(box.control()))
}
