import { Effect } from "effect"
import * as program from "./out/main.js"

{
  const p = new program.Counter(10).compact(1)
  console.log("compact", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = new program.Counter(10).expanded(1)
  console.log("expanded", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.Counter.compound(1)
  console.log("compound", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = new program.Counter(10).assignment(1)
  console.log("assignment", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = new program.Counter(0).destructured({ n: 1 })
  console.log("destructured", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = new program.Counter(0).loop(1)
  console.log("loop", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.object.read(1)
  console.log("object", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.nested(1)
  console.log("nested", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.destructuringAssignment(1)
  console.log("array assignment", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.objectAssignment(1)
  console.log("object assignment", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.postfix(1)
  console.log("postfix", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
{
  const p = program.logical(0)
  console.log("logical", JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
}
for (const [name, p] of [
  ["var redeclaration", new program.Counter(0).redeclared(1)],
  ["arguments", new program.Counter(0).argumentsRead(1)],
  ["private method", new program.Counter(0).operation(1)],
  ["super", new program.Derived().read(1)]
]) console.log(name, JSON.stringify([Effect.runSync(p), Effect.runSync(p), Effect.runSync(p)]))
