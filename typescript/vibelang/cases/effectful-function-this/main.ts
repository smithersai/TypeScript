import { Effect } from "effect"
import { read } from "./read.vibe"

console.log(await Effect.runPromise(read.call({ value: 40 }, 2)))
const obj = { value: 40, read }
obj.read = read
console.log(await Effect.runPromise(obj.read(3)))
