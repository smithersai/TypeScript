// expect-result: {"two":[1,2],"total":6,"loud":"HI","pair":[3,3]}
// main.ts stays TypeScript: it calls util, which the migration moves to VibeLang.
import { Effect } from "effect"
import { firstTwo, pair, shout, total } from "./util.js"

export function main() {
  return Effect.succeed({ two: firstTwo([1, 2, 3]), total: total([1, 2, 3]), loud: shout("hi"), pair: pair(3) })
}
