import { Effect } from "effect"
import { Counter } from "./counter.vibe"

const counter = new Counter()
const bump = counter.bump()
console.log("values", JSON.stringify([Effect.runSync(bump), Effect.runSync(bump), Effect.runSync(bump)]))
console.log("count", counter.count)
