import assert from "node:assert/strict"
import { test } from "node:test"
import { compareTests, parseVitestJson, tally, withJsonReporter } from "../lib/tests.mjs"

test("withJsonReporter adds Vitest's JSON reporter only to a Vitest command", () => {
  assert.equal(withJsonReporter("pnpm exec vitest run", "/run/v.json"), "pnpm exec vitest run --reporter=default --reporter=json --outputFile.json='/run/v.json'")
  assert.equal(withJsonReporter("bun test", "/run/v.json"), "bun test")
  assert.equal(withJsonReporter("vitest run --coverage", "/v.json"), "vitest run --coverage --coverage.reportOnFailure --reporter=default --reporter=json --outputFile.json='/v.json'")
})

const report = (ext, statusOf) => ({
  testResults: [
    { name: `/repo/src/a.test.${ext}`, status: "passed", assertionResults: [{ fullName: "a works", status: statusOf("a works") }, { fullName: "a skips", status: "skipped" }] },
    { name: "/repo/src/b.test.ts", status: "failed", assertionResults: [] }
  ]
})

test("parseVitestJson keys tests by file without extension and full name", () => {
  const tests = parseVitestJson(report("ts", () => "passed"), "/repo")
  assert.deepEqual(tests, { "src/a.test > a works": "passed", "src/a.test > a skips": "skipped", "src/b.test > (file)": "failed" })
  assert.deepEqual(tally(tests), { total: 3, passed: 1, failed: ["src/b.test > (file)"], skipped: 1 })
  assert.deepEqual(parseVitestJson(report("vibe", () => "passed"), "/repo"), tests)
})

test("tests that share a name in one file keep one entry each", () => {
  const tests = parseVitestJson({ testResults: [{ name: "/repo/a.test.ts", assertionResults: [{ fullName: "same", status: "passed" }, { fullName: "same", status: "failed" }] }] }, "/repo")
  assert.deepEqual(tests, { "a.test > same": "passed", "a.test > same [2]": "failed" })
})

test("compareTests finds new failures and missing tests, and ignores failures the baseline had", () => {
  const baseline = { code: 1, tests: { "a > x": "passed", "a > y": "failed", "a > z": "passed" } }
  assert.deepEqual(compareTests(baseline, { code: 1, tests: { "a > x": "passed", "a > y": "failed", "a > z": "passed" } }), { ok: true, newFailures: [], missing: [], fixed: [] })
  assert.deepEqual(compareTests(baseline, { code: 1, tests: { "a > x": "failed", "a > y": "passed" } }), { ok: false, newFailures: ["a > x"], missing: ["a > z"], fixed: ["a > y"] })
})

test("without per-test results, only the exit status can regress", () => {
  assert.equal(compareTests({ code: 0, tests: null }, { code: 1, tests: null }).ok, false)
  assert.equal(compareTests({ code: 1, tests: null }, { code: 1, tests: null }).ok, true)
})
