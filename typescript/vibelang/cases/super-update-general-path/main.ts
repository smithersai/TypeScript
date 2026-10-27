import { Effect } from "effect"
import { Counter } from "./counter.vibe"

const counter = new Counter()
console.log(JSON.stringify([Effect.runSync(counter.fast()), Effect.runSync(counter.general()), counter.value]))
