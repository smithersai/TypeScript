import { Effect } from "effect"
import { f } from "./main.vibe"
const forward: (n: number) => Effect.Effect<number, never, never> = f
const backward: typeof f = forward
void backward
