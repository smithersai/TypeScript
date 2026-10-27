import { Effect } from "effect"
import { read } from "./read.vibe"

const obj = { value: 42, read }
obj.read = read
console.log(Effect.runSync(obj.read()))
