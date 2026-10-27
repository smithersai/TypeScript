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
