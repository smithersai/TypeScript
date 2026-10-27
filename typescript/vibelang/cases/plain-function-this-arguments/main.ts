import { Effect } from "effect"
import { read } from "./read.vibe"

const obj = { value: 40, read }
const pending = obj.read(2)
obj.value = 50
const other = { value: 10, read }
const otherPending = other.read(3, 2, 4, 5)
console.log(Effect.runSync(pending))
console.log(Effect.runSync(otherPending))
console.log(Effect.runSync(pending))
console.log(Effect.runSync(read.call({ value: 10 }, 2, 3, 4, 5)))
console.log(Effect.runSync(read.apply({ value: 10 }, [2, 3, 4, 5])))
const bound = read.bind({ value: 10 }, 2)
console.log(Effect.runSync(bound(3, 4, 5)))
