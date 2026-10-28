import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
const text = readFileSync(new URL("../user/src/vibelang-features/114-vibelang-for-effect-users.md", import.meta.url), "utf8")
test("porting table explains service value members and EK4503", () => {
  const row = text.split("\n").find(line => line.startsWith("| `const users = yield* Users`"))
  assert.ok(row)
  assert.match(row, /Users\(\)\.region/)
  assert.match(row, /EK4503/)
})
test("porting table distinguishes typed results from full causes", () => {
  const row = text.split("\n").find(line => line.startsWith("| `Effect.result(program)`"))
  assert.ok(row)
  assert.match(row, /Effect\.result\(\(\) => program\(\)\)/)
  assert.match(text, /Defects and interruption propagate/)
  assert.match(text, /exit\(\(\) => program\(\)\)/)
  assert.match(text, /Exit\.Failure/)
})
