import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { mergeFixes, parseFixOutput, renameBatch, rewriteImports, rewriteSpecifier, rewriteTotals, vibePath } from "../lib/codemod.mjs"

test("vibePath renames only .ts modules", () => {
  assert.equal(vibePath("src/a.ts"), "src/a.vibe")
  assert.throws(() => vibePath("src/a.d.ts"))
  assert.throws(() => vibePath("src/a.tsx"))
})

test("a .vibe importer names local modules by their source names", () => {
  assert.equal(rewriteSpecifier("src/a.vibe", "./b.js", "src/b.vibe"), "./b.vibe")
  assert.equal(rewriteSpecifier("src/a.vibe", "./c.js", "src/c.ts"), "./c.ts")
  assert.equal(rewriteSpecifier("src/a.vibe", "../d/index.js", "d/index.ts"), "../d/index.ts")
  assert.equal(rewriteSpecifier("src/a.vibe", "./e", "src/e.ts"), "./e.ts")
  assert.equal(rewriteSpecifier("src/a.vibe", "./dir", "src/dir/index.vibe"), "./dir/index.vibe")
  assert.equal(rewriteSpecifier("src/a.vibe", "./b.vibe", "src/b.vibe"), "./b.vibe")
})

test("a .ts importer keeps .js specifiers, and a .ts specifier of a renamed module becomes .vibe", () => {
  assert.equal(rewriteSpecifier("src/a.ts", "./b.js", "src/b.vibe"), "./b.js")
  assert.equal(rewriteSpecifier("src/a.ts", "./b.ts", "src/b.vibe"), "./b.vibe")
  assert.equal(rewriteSpecifier("src/a.ts", "./c.js", "src/c.ts"), "./c.js")
})

test("renameBatch and rewriteImports update a small package", () => {
  const root = mkdtempSync(join(tmpdir(), "migrate-codemod-"))
  try {
    mkdirSync(join(root, "src"))
    writeFileSync(join(root, "src/a.ts"), "import { b } from './b.js'\nimport { c } from './c.js'\nexport const a = b + c\n")
    writeFileSync(join(root, "src/b.ts"), "export const b = 1\n")
    writeFileSync(join(root, "src/c.ts"), "import { a } from './a.js'\nexport const c = 2\n")
    writeFileSync(join(root, "src/d.vibe"), "import { a } from './a.ts'\n")
    const renames = renameBatch(root, ["src/a.ts"])
    assert.deepEqual(renames, [{ from: "src/a.ts", to: "src/a.vibe" }])
    assert.throws(() => renameBatch(root, ["src/a.ts"]), /does not exist/)
    const edits = rewriteImports(root, ["src/a.vibe", "src/b.ts", "src/c.ts", "src/d.vibe"])
    assert.deepEqual(edits, [
      { file: "src/a.vibe", from: "./b.js", to: "./b.ts" },
      { file: "src/a.vibe", from: "./c.js", to: "./c.ts" },
      { file: "src/d.vibe", from: "./a.ts", to: "./a.vibe" }
    ])
    assert.equal(readFileSync(join(root, "src/a.vibe"), "utf8"), "import { b } from './b.ts'\nimport { c } from './c.ts'\nexport const a = b + c\n")
    assert.equal(readFileSync(join(root, "src/c.ts"), "utf8"), "import { a } from './a.js'\nexport const c = 2\n")
    assert.equal(existsSync(join(root, "src/a.ts")), false)
    assert.deepEqual(rewriteImports(root, ["src/a.vibe", "src/b.ts", "src/c.ts", "src/d.vibe"]), [])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("parseFixOutput reads applied rewrites, refusals and the total", () => {
  const output = [
    "vibelang --fix: src/users.vibe: 4 fixes (EK4830 ×1, EK4831 ×1, EK4833 ×1, prelude import ×1)",
    "vibelang --fix: src/one.vibe: 1 fix (EK4834 ×1)",
    "vibelang --fix: src/users.vibe:12: EK4835 not fixed: the fixed program would report TS2322: Type 'unknown' is not assignable",
    "vibelang --fix: 5 fixes in 2 files; 1 fix refused.",
    "src/users.vibe(8,60): error EK1002: Effect.gen expects a JavaScript generator"
  ].join("\n")
  const parsed = parseFixOutput(output, { cwd: "/repo/packages/p", root: "/repo" })
  assert.equal(parsed.total, 5)
  assert.deepEqual(parsed.files, {
    "packages/p/src/users.vibe": { EK4830: 1, EK4831: 1, EK4833: 1, "prelude import": 1 },
    "packages/p/src/one.vibe": { EK4834: 1 }
  })
  assert.deepEqual(parsed.refused, [{ file: "packages/p/src/users.vibe", line: 12, code: "EK4835", error: "TS2322: Type 'unknown' is not assignable" }])
  assert.deepEqual(parseFixOutput("vibelang --fix: 0 fixes in 0 files.\n"), { total: 0, files: {}, refused: [] })
})

test("mergeFixes and rewriteTotals add rounds and files", () => {
  const merged = mergeFixes(mergeFixes({}, { a: { EK4830: 1 } }), { a: { EK4830: 2, "prelude import": 1 }, b: { EK4833: 1 } })
  assert.deepEqual(merged, { a: { EK4830: 3, "prelude import": 1 }, b: { EK4833: 1 } })
  assert.deepEqual(rewriteTotals(merged), { EK4830: 3, "prelude import": 1, EK4833: 1 })
})
