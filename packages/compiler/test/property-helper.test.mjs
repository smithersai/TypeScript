import { strict as assert } from "node:assert"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import fc from "fast-check"
import { checkProperty } from "../../../scripts/testing/property.mjs"

const base = { name: "helper", rule: "metamorphic: replay preserves the shrunk counterexample", command: "node --test test/property-helper.test.mjs" }

test("property helper shrinks, records bounded evidence, saves files and replays exactly", async t => {
  const directory = mkdtempSync(join(tmpdir(), "vibelang-property-helper-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const options = {
    ...base, arbitrary: fc.integer({ min: 1, max: 100 }), check: n => assert.equal(n, 0),
    artifacts: n => ({ "project/input.txt": String(n) }), diagnostics: () => "x".repeat(20000)
  }
  const env = { FC_RUNS: "1", FC_SEED: "42", FC_ARTIFACT_DIR: directory }
  await assert.rejects(checkProperty(fc, { ...options, env }), /FC_PROPERTY='helper' FC_SEED=42 FC_PATH=/)
  const failure = JSON.parse(readFileSync(join(directory, "helper/failure.json"), "utf8"))
  assert.equal(failure.input, 1)
  assert.ok(failure.numShrinks > 0)
  assert.equal(failure.fastCheckVersion, "4.10.2")
  assert.equal(failure.generatorVersion, 1)
  assert.equal(failure.diagnostics.length, 12000)
  assert.equal(readFileSync(join(directory, "helper/project/input.txt"), "utf8"), "1")
  await assert.rejects(checkProperty(fc, { ...options,
    env: { ...env, FC_PROPERTY: "helper", FC_PATH: failure.counterexamplePath }
  }), /property helper failed/)
  assert.equal(JSON.parse(readFileSync(join(directory, "helper/failure.json"), "utf8")).input, failure.input)
})

test("property helper scopes replay paths and validates run controls", async () => {
  const options = { ...base, arbitrary: fc.constant(0), check: () => assert.fail("unselected property ran") }
  await checkProperty(fc, { ...options, env: { FC_PROPERTY: "other", FC_PATH: "0" } })
  await assert.rejects(checkProperty(fc, { ...options, env: { FC_PATH: "0" } }), /requires FC_PROPERTY/)
  for (const FC_RUNS of ["0", "-1", "1.5", ""]) {
    await assert.rejects(checkProperty(fc, { ...options, env: { FC_RUNS } }), /FC_RUNS must be an integer/)
  }
})

test("property helper replays saved input before discovery and fails on known-failure XPASS", async t => {
  const directory = mkdtempSync(join(tmpdir(), "vibelang-property-regressions-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const file = join(directory, "example.json")
  writeFileSync(file, JSON.stringify({ property: "helper", input: 9 }))
  const seen = []
  const options = { ...base, arbitrary: fc.constant(0), numRuns: 1, env: {},
    regressions: pathToFileURL(directory + "/"), check: n => { seen.push(n) } }
  await checkProperty(fc, options)
  assert.deepEqual(seen, [9, 0])
  writeFileSync(file, JSON.stringify({ property: "helper", input: 9, knownFailure: true, rule: "metamorphic harness example" }))
  await assert.rejects(checkProperty(fc, options), /XPASS example.json/)
})
