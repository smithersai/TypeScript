import { Effect } from "effect"
import * as program from "./out/main.js"

{
  const p = program.compact(1, 2)
  console.log("compact", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.expanded(1, 2)
  console.log("expanded", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.declared(1, 2)
  console.log("declaration", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.expression(1, 2)
  console.log("expression", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = new program.Counter().compact(1, 2)
  console.log("method compact", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = new program.Counter().expanded(1, 2)
  console.log("method expanded", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.object.read(1, 2)
  console.log("object method", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
const fresh = program.fresh(1, 2)
const first = Effect.runSync(fresh)
const second = Effect.runSync(fresh)
const third = Effect.runSync(fresh)
console.log("fresh arrays", first !== second && second !== third && first !== third)
for (const [name, p] of [
  ["default", new program.Defaults().read()],
  ["destructured default", new program.Defaults().destructured()],
  ["effect declaration", program.declaredProgram(1, 2)]
]) console.log(name, JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
