import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

test("CLI reference watch distinguishes selected inputs from the reference graph", () => {
  const text = read("docs/user/src/setup/vibelang-cli.md")
  assert.match(text, /vibelang -b -w/)
  assert.match(text, /selected project/)
})
