import assert from "node:assert/strict"
import { test } from "node:test"
import { newErrors, parseDiagnostics, styleProblems, summarize } from "../lib/diagnostics.mjs"

const output = `src/users.vibe(8,60): error EK1002: Effect.gen expects a JavaScript generator, but in VibeLang function* declares a producer.
  Write the body as an ordinary function: remove Effect.gen, function*, and yield*.
src/users.vibe(16,26): error EK4402: process.pid is platform code, which VibeLang code does not use directly.
  Use the experimental Process service:   Experimental.Process.pid()
src/users.vibe(3,1): warning EK4831: Users extends Context.Service; in VibeLang a service is a service declaration: service Users { … }.
src/other.ts(1,7): error TS2322: Type 'string' is not assignable to type 'number'.
error TS5096: Option 'allowImportingTsExtensions' can only be used when 'noEmit' or 'emitDeclarationOnly' is set.
`

test("parseDiagnostics reads file, position, category, code, message and notes", () => {
  const ds = parseDiagnostics(output, { cwd: "/repo/pkg", root: "/repo" })
  assert.equal(ds.length, 5)
  assert.deepEqual(ds[0], { file: "pkg/src/users.vibe", line: 8, column: 60, category: "error", code: "EK1002", message: "Effect.gen expects a JavaScript generator, but in VibeLang function* declares a producer.", notes: ["Write the body as an ordinary function: remove Effect.gen, function*, and yield*."] })
  assert.equal(ds[2].category, "warning")
  assert.deepEqual([ds[4].file, ds[4].code], [null, "TS5096"])
})

test("summarize splits the batch's diagnostics from the rest", () => {
  const ds = parseDiagnostics(output)
  const s = summarize(ds, ["src/users.vibe"])
  assert.deepEqual(s.batch, { errors: 2, warnings: 1, byCode: { EK1002: 1, EK4402: 1, EK4831: 1 } })
  assert.equal(s.other.errors, 2)
})

test("styleProblems are EK48xx and EK4402 in the given files only", () => {
  const ds = parseDiagnostics(output)
  assert.deepEqual(styleProblems(ds, ["src/users.vibe"]).map((d) => d.code), ["EK4402", "EK4831"])
  assert.deepEqual(styleProblems(ds, ["src/other.ts"]), [])
})

test("newErrors keeps a file's identity across the rename and counts repeats", () => {
  const before = parseDiagnostics("src/a.ts(1,1): error TS2322: X.\nsrc/a.ts(2,1): error TS2322: X.\n")
  const after = parseDiagnostics("src/a.vibe(1,1): error TS2322: X.\nsrc/a.vibe(3,1): error TS2322: X.\nsrc/a.vibe(4,1): error TS2322: X.\nsrc/a.vibe(5,1): warning EK4831: W.\n")
  assert.equal(newErrors(before, after).length, 1)
  assert.deepEqual(newErrors(after, before), [])
})
