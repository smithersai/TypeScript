import { Effect } from "effect"
import { defaults, optional, rest } from "./out/main.js"

for (const [name, p] of [["default", defaults], ["optional", optional], ["rest", rest]]) {
  console.log(name, JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
const first = Effect.runSync(rest)
const second = Effect.runSync(rest)
const third = Effect.runSync(rest)
console.log("fresh arrays", first !== second && second !== third && first !== third)
