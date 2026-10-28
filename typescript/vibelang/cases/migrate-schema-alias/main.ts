// expect-result: {"kind":"incognito","id":7,"tags":["a","b"],"mode":"dark","name":null,"refused":false}
// main.ts stays TypeScript: it decodes with kinds' schemas, which the migration moves to VibeLang.
import { Effect, Schema } from "effect"
import { Id, Kind, Mode, Name, Tags } from "./kinds.js"

export function main() {
  const kind: Kind = Schema.decodeUnknownSync(Kind)("incognito")
  const id: Id = Schema.decodeUnknownSync(Id)(7)
  const tags: Tags = Schema.decodeUnknownSync(Tags)(["a", "b"])
  const mode: Mode = Schema.decodeUnknownSync(Mode)("dark")
  const name: Name = Schema.decodeUnknownSync(Name)(null)
  return Effect.succeed({ kind, id, tags, mode, name, refused: Schema.is(Kind)("guest") })
}
