import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { createHighlighter } from "shiki"
import { addVibeLangSyntax } from "./vibelang-grammar.mjs"

// Exercise the generator through the same TextMate engine used by editors.
const grammar = addVibeLangSyntax(JSON.parse(readFileSync(new URL("../syntaxes/VibeLang.tmLanguage.json", import.meta.url), "utf8")))
const highlighter = await createHighlighter({ themes: ["github-light"], langs: [grammar, "typescript"] })
function keyword(source, word) {
  const { tokens } = highlighter.codeToTokens(source, { lang: "VibeLang", theme: "github-light", includeExplanation: "scopeName" })
  return tokens.flat().filter(t => t.content.trim() === word).some(t =>
    t.explanation?.some(e => e.scopes.some(s => s.scopeName === "keyword.control.flow.ts")))
}

test("fork remains an identifier before an in operator", () => {
  assert.equal(keyword("export const hit = fork in table;", "fork"), false)
  assert.equal(keyword("export const hit = fork work();", "fork"), true)
  assert.equal(keyword("export const hit = fork inspect();", "fork"), true)
})
