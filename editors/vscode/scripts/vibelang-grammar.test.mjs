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

test("join remains an identifier before TypeScript assertions and operators", () => {
  for (const operator of ["as any", "satisfies unknown", "in table", "instanceof Fiber"]) {
    assert.equal(keyword(`export const hit = join ${operator};`, "join"), false, operator)
  }
  assert.equal(keyword("export const hit = join fiber;", "join"), true)
  assert.equal(keyword("export const hit = join assigned;", "join"), true)
})

test("interruption blocks have contextual keyword scopes", () => {
  const source = "export function f() { uninterruptible { restore { } } interruptible { } }"
  for (const word of ["uninterruptible", "restore", "interruptible"]) {
    assert.equal(keyword(source, word), true, word)
    assert.equal(keyword(`export const x = ${word} + 1;`, word), false, word)
    assert.equal(keyword(`export const x = obj.${word};`, word), false, word)
  }
})
