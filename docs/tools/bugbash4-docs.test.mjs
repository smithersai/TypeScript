import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

test("CLI reference watch distinguishes selected inputs from the reference graph", () => {
  const text = read("docs/user/src/setup/vibelang-cli.md")
  assert.match(text, /vibelang -b -w/)
  assert.match(text, /selected project/)
})

test("both Bun loader entry points disclose the observed watch limit and dev alternative", () => {
  for (const path of ["packages/compiler/README.md", "docs/user/src/setup/vibelang-cli.md"]) {
    const text = read(path)
    assert.match(text, /Bun 1\.4\.1.*`bun --watch --preload vibelang\/bun`/)
    assert.match(text, /does not reliably restart/)
    assert.match(text, /bun run dev/)
  }
})

test("Bun test instructions install and enable declarations before running Effects", () => {
  for (const path of ["packages/compiler/README.md", "docs/user/src/setup/vibelang-cli.md"]) {
    const text = read(path)
    for (const part of ["bun add -d @types/bun", '"types": ["bun"]', '[test]', 'preload = ["vibelang/bun"]', 'from "bun:test"', "Effect.runSync(greeting("]) assert.ok(text.includes(part), part)
  }
})
