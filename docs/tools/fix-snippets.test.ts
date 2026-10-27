import { expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { extract, defaultCompiler, linkModules } from "./check-snippets"
import { annotateRegions, fixPage, preserveDirectives, replaceBlocks } from "./fix-snippets"

test("replaces repeated blocks by span and preserves CRLF, fences, prose and output", () => {
  const markdown = "intro\r\n~~~vibe\r\nconst x = 1\r\n~~~\r\n\r\n```output\r\n1\r\n```\r\n```vibe\r\nconst x = 1\r\n```\r\nend\r\n"
  const result = replaceBlocks(markdown, extract(markdown), new Map([[2, "const x = () => 1"]]))
  expect(result).toBe(markdown.replace("```vibe\r\nconst x = 1", "```vibe\r\nconst x = () => 1"))
})

test("replacing an empty block preserves its closing fence", () => {
  const markdown = "```vibe\n```\nprose\n"
  expect(replaceBlocks(markdown, extract(markdown), new Map([[1, "const x = 1"]])))
    .toBe("```vibe\nconst x = 1\n```\nprose\n")
})

test("S0 migration-only fixes preserve existing style examples", async () => {
  const temp = mkdtempSync(join(tmpdir(), "fix-snippets-noop-"))
  try {
    linkModules(temp)
    const dir = join(temp, "page")
    mkdirSync(dir)
    const markdown = '```vibe\nimport { Effect } from "effect"\nexport function read(): Effect.Effect<number> { return Effect.succeed(1) }\n```\n'
    expect(await fixPage(markdown, dir, defaultCompiler())).toEqual({ markdown, changed: 0, blocks: 1 })
  } finally { rmSync(temp, { recursive: true, force: true }) }
}, 60000)

test("plain-TypeScript directives survive byte for byte", () => {
  const source = "  // Plain TypeScript inside this hatch, not VibeLang.\n  // sync's first argument is plain TypeScript, not VibeLang."
  expect(() => preserveDirectives(source, source)).not.toThrow()
  expect(() => preserveDirectives(source, source.replace("  //", " //"))).toThrow("plain-TypeScript comment changed")
  expect(() => preserveDirectives(source, "")).toThrow()
  const inline = "const x = sync(() => 1) // sync's first argument is plain TypeScript, not VibeLang."
  expect(() => preserveDirectives(inline, inline.replace("const x", "const renamed"))).not.toThrow()
})

test("new hatches and modules carry the documented comments, idempotently", () => {
  const source = 'const x = sync(() => 1)\nmodule helper {\n  export const value = 1\n}\nconst y = try(() => {\n  return 1\n})'
  const annotated = annotateRegions(source)
  expect(annotated).toContain("// sync's first argument is plain TypeScript, not VibeLang.")
  expect(annotated).toContain("// Plain TypeScript inside this hatch, not VibeLang.")
  expect(annotated).toContain("// Plain TypeScript inside this module, not VibeLang.")
  expect(annotateRegions(annotated)).toBe(annotated)
})

// A compiler wrapper injects a plausible but incorrect fix. The real compiler
// then checks and runs it: the page transaction must refuse the changed output.
test("refuses a type-correct fix whose expected stdout changes", async () => {
  const temp = mkdtempSync(join(tmpdir(), "fix-snippets-test-"))
  try {
    linkModules(temp)
    const wrapper = join(temp, "compiler")
    writeFileSync(wrapper, `#!/usr/bin/env bun\nimport { readFileSync, writeFileSync } from "node:fs";\nimport { dirname, join } from "node:path";\nconst args = process.argv.slice(2);\nif (args.includes("--fix")) { const dir = dirname(args[args.indexOf("-p") + 1]); const path = join(dir, "block-1.vibe"); writeFileSync(path, readFileSync(path, "utf8").replace('Console.log("before")', 'Console.log("after")')); }\nconst child = Bun.spawn([${JSON.stringify(defaultCompiler())}, ...args.filter(arg => arg !== "--fix")], { stdout: "inherit", stderr: "inherit" }); process.exit(await child.exited);\n`, { mode: 0o755 })
    const dir = join(temp, "page")
    mkdirSync(dir)
    const markdown = '```vibe\nexport function main() { Console.log("before") }\n// Output: before\n```\n'
    await expect(fixPage(markdown, dir, wrapper, 10000, true)).rejects.toThrow("expected output changed")
    expect(readFileSync(join(dir, "fix/block-1.vibe"), "utf8")).toContain('Console.log("after")')
  } finally { rmSync(temp, { recursive: true, force: true }) }
}, 60000)
