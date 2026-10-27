import { Effect } from "effect"
import { Counter } from "./args.vibe"

const thrice = <A>(program: Effect.Effect<A>) => [Effect.runSync(program), Effect.runSync(program), Effect.runSync(program)]
const counter = new Counter()
console.log("defaulted", JSON.stringify(thrice(counter.defaulted(10))))
console.log("rest", JSON.stringify(thrice(counter.rest(10))))
console.log("written", JSON.stringify(thrice(counter.written(10))))
console.log("identity", Effect.runSync(counter.identity(10)))
