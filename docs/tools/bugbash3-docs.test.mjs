import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import { test } from "node:test"
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
const pages = dir => readdirSync(new URL(`../../${dir}`, import.meta.url), { recursive: true })
  .filter(name => name.endsWith(".md")).map(name => `${dir}/${name}`)

test("no page says a platform value may be imported or passed (D310 amends D108)", () => {
  // The release notes and the decision log keep their history.
  const current = [...pages("docs/user/src"), ...pages("docs/design/src"), "packages/compiler/skills/vibelang/SKILL.md"]
    .filter(path => !path.endsWith("release-notes.md") && !path.endsWith("529-part5-ch29-decisions.md"))
  for (const path of current) {
    assert.ok(!/(?:importing|passing)[^.|\n]{0,60}(?:value|binding)[^.|\n]{0,30}\b(?:is|are) (?:allowed|fine)/i.test(read(path)), path)
  }
  assert.match(read("docs/design/src/428-part4-ch28-tooling.md"), /\| EK4402 \| [^\n]*held as a value[^\n]*\(D310/)
})
