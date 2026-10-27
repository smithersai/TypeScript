import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
test("proposal status accounts for shipped unplugin adapters", () => {
  const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
  const status = read("site/src/pages/proposals.mdx").split("## Bundler plugins")[1].split("\n\n")[1]
  assert.match(status, /vibelang-unplugin/)
  const pkg = JSON.parse(read("packages/unplugin/package.json"))
  for (const adapter of ["webpack", "rollup", "rolldown", "esbuild", "rspack", "bun"]) {
    assert.ok(pkg.exports[`./${adapter}`])
    assert.ok(status.toLowerCase().includes(adapter), adapter)
  }
  assert.doesNotMatch(status, /Plugins for other bundlers are missing/)
})
