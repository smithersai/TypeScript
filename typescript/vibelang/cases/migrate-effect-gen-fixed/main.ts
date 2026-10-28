// expect-result: {"greeting":"Hello, Ada","other":"Hello, user-7","count":6,"box":12,"checked":["ok 3","Gone"],"doubled":[2,4,6],"text":"n=1\n  done"}
// main.ts stays TypeScript: it calls lib, which the migration moves to VibeLang.
import { Effect } from "effect"
import { Box, check, count, describe, doubleAll, greet, UsersLive } from "./lib.js"

export function main() {
  return Effect.gen(function* () {
    const failed = yield* Effect.flip(check(-1))
    return {
      greeting: yield* greet("1"),
      other: yield* greet("7"),
      count: yield* count(3),
      box: yield* new Box(6).doubled(),
      checked: [yield* check(3), failed._tag],
      doubled: yield* doubleAll([1, 2, 3]),
      text: yield* describe(Effect.succeed(1)),
    }
  }).pipe(Effect.provide(UsersLive))
}
