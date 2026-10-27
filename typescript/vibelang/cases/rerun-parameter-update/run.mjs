import { Effect } from "effect"
import * as program from "./out/main.js"

{
  const p = program.compact(1)
  console.log("compact", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.expanded(1)
  console.log("expanded", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.declared(1)
  console.log("declaration", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.expression(1)
  console.log("expression", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
const p = program.declaredProgram(1)
console.log("effect declaration", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
const returned = program.closure(1)
const closures = [Effect.runSync(returned), Effect.runSync(returned), Effect.runSync(returned)]
console.log("returned closures", JSON.stringify(closures.map((f) => f())))
