import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = path => readFileSync(new URL(path, root), "utf8")

test("setup instructions address the person following them", () => {
  for (const name of ["existing-project", "vscode", "vite", "vibelang-cli", "react", "vue", "svelte"]) {
    const page = read(`docs/user/src/setup/${name}.md`)
    assert.doesNotMatch(page, /(?:tell|ask) the user|the user's editor/i, name)
  }
})

test("the shipped skill demonstrates Effect 4 config and scoped file IO", () => {
  const skill = read("packages/compiler/skills/vibelang/SKILL.md")
  assert.doesNotMatch(skill, /that reading is never wrong/)
  assert.match(skill, /Config\.withDefault\(Config\.String\("NAME"\), "stranger"\)\(\)/)
  assert.match(skill, /using directory = FileSystem\.makeTempDirectoryScoped\(\)/)
  assert.match(skill, /import "vibelang\/platform\/node"/)
})
