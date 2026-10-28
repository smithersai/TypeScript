import assert from "node:assert/strict"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { jsonDeclarations, jsonStrings, planUpgrade, selectorTarget, setJsonOverrides, setYamlOverrides, yamlDeclarations } from "../lib/upgrade.mjs"
import { readIssues } from "../lib/issues.mjs"
import { flowStep, nextStep, paths, upgradeEffect } from "../lib/steps.mjs"
import * as Jj from "../lib/jj.mjs"
import { must, readJson, writeJson } from "../lib/util.mjs"

test("jsonStrings gives each string value its key path and offsets inside the quotes", () => {
  const text = '{ "a": { "b": "x\\"y" }, "c": ["d", 1, { "e": "f" }], "g": true }'
  const found = jsonStrings(text).map((s) => [s.path.join("."), s.value, text.slice(s.start, s.end)])
  assert.deepEqual(found, [["a.b", 'x"y', 'x\\"y'], ["c.0", "d", "d"], ["c.2.e", "f", "f"]])
  assert.throws(() => jsonStrings("{ nope }"))
})

test("selectorTarget reads the package an overrides key names", () => {
  assert.equal(selectorTarget("effect"), "effect")
  assert.equal(selectorTarget("@opencode/schema>effect"), "effect")
  assert.equal(selectorTarget("@effect/vitest>vitest"), "vitest")
  assert.equal(selectorTarget("effect@^4"), "effect")
  assert.equal(selectorTarget("**/@effect/platform"), "@effect/platform")
})

test("jsonDeclarations finds Effect versions in dependencies, catalogs, overrides and resolutions, and skips references", () => {
  const text = JSON.stringify({
    dependencies: { effect: "4.0.1", other: "1.0.0", "@effect/sql": "catalog:" },
    peerDependencies: { effect: "^4.0.1" },
    devDependencies: { "@effect/vitest": "workspace:*", "@effect/x": "npm:@effect/y@4.0.1" },
    workspaces: { catalog: { "@effect/platform-node": "4.0.1" }, catalogs: { old: { effect: "~4.0.0" } } },
    catalogs: { next: { "@effect/opentelemetry": "4.0.1" } },
    overrides: { "@opencode/schema>effect": "4.0.1" },
    pnpm: { overrides: { "@effect/sql-pg": "4.0.1" } },
    resolutions: { "**/effect": "4.0.1" }
  }, null, 2)
  assert.deepEqual(jsonDeclarations(text).map((d) => [d.name, d.spec, d.peer, text.slice(d.start, d.end)]), [
    ["effect", "4.0.1", false, "4.0.1"],
    ["effect", "^4.0.1", true, "^4.0.1"],
    ["@effect/platform-node", "4.0.1", false, "4.0.1"],
    ["effect", "~4.0.0", false, "~4.0.0"],
    ["@effect/opentelemetry", "4.0.1", false, "4.0.1"],
    ["effect", "4.0.1", false, "4.0.1"],
    ["@effect/sql-pg", "4.0.1", false, "4.0.1"],
    ["effect", "4.0.1", false, "4.0.1"]
  ])
})

const workspaceYaml = `packages:
  - packages/*

catalog:
  effect: 4.0.5
  "@effect/vitest": 4.0.5 # with a comment
  "@effect/platform-node": 4.0.5
  '@effect/tsgo': 0.57.0

catalogs:
  legacy:
    effect: ^4.0.4

overrides:
  effect: "catalog:"
  "@effect/vitest>vitest": "-"
  "@opencode/schema>effect": 4.0.5

minimumReleaseAgeExclude:
  - effect@4.0.5
`

test("yamlDeclarations finds Effect versions in the catalog, named catalogs and overrides only", () => {
  assert.deepEqual(yamlDeclarations(workspaceYaml).map((d) => [d.name, d.spec, workspaceYaml.slice(d.start, d.end)]), [
    ["effect", "4.0.5", "4.0.5"],
    ["@effect/vitest", "4.0.5", "4.0.5"],
    ["@effect/platform-node", "4.0.5", "4.0.5"],
    ["@effect/tsgo", "0.57.0", "0.57.0"],
    ["effect", "^4.0.4", "^4.0.4"],
    ["effect", "4.0.5", "4.0.5"]
  ])
})

test("setYamlOverrides adds the pins the block lacks and keeps the values it has", () => {
  const yaml = "packages:\n  - 'packages/*'\n\noverrides:\n  '@types/node': 26.4.0\n  effect: \"catalog:\"\n\n  'monaco-editor>dompurify': 3.4.14\nother: 1\n"
  assert.equal(setYamlOverrides(yaml, { effect: "4.0.6", "@effect/vitest": "4.0.6" }),
    "packages:\n  - 'packages/*'\n\noverrides:\n  '@types/node': 26.4.0\n  effect: \"catalog:\"\n\n  'monaco-editor>dompurify': 3.4.14\n  '@effect/vitest': 4.0.6\nother: 1\n")
  assert.equal(setYamlOverrides("packages:\n  - a\n", { effect: "4.0.6" }), "packages:\n  - a\n\noverrides:\n  effect: 4.0.6\n")
})

test("setJsonOverrides adds missing pins under pnpm for pnpm, at the top level otherwise", () => {
  assert.deepEqual(setJsonOverrides({ name: "x" }, { effect: "4.0.6" }, "pnpm"), { name: "x", pnpm: { overrides: { effect: "4.0.6" } } })
  assert.deepEqual(setJsonOverrides({ overrides: { a: "1", effect: "catalog:" } }, { effect: "4.0.6", "@effect/sql": "4.0.6" }, "npm"), { overrides: { a: "1", effect: "catalog:", "@effect/sql": "4.0.6" } })
})

test("planUpgrade moves Effect and its major line wherever a pnpm workspace declares them, keeping formatting and references", () => {
  const core = '{\n  "name": "core",\n  "files": ["dist"],\n  "dependencies": { "effect": "catalog:" },\n  "peerDependencies": { "effect": "^4.0.5" }\n}\n'
  const plan = planUpgrade([{ path: "package.json", text: "{}\n" }, { path: "pnpm-workspace.yaml", text: workspaceYaml }, { path: "packages/core/package.json", text: core }], "4.0.6", "pnpm")
  assert.equal(plan.from, "4.0.5")
  assert.deepEqual(plan.pins, { effect: "4.0.6", "@effect/vitest": "4.0.6", "@effect/platform-node": "4.0.6", "@effect/platform-node-shared": "4.0.6" })
  assert.deepEqual(plan.files.map((f) => f.path), ["pnpm-workspace.yaml", "packages/core/package.json"])
  assert.equal(plan.files[0].text, workspaceYaml
    .replace("effect: 4.0.5", "effect: 4.0.6").replace('"@effect/vitest": 4.0.5', '"@effect/vitest": 4.0.6')
    .replace('"@effect/platform-node": 4.0.5', '"@effect/platform-node": 4.0.6').replace("effect: ^4.0.4", "effect: 4.0.6")
    .replace('"@opencode/schema>effect": 4.0.5', `"@opencode/schema>effect": 4.0.6\n  '@effect/vitest': 4.0.6\n  '@effect/platform-node': 4.0.6\n  '@effect/platform-node-shared': 4.0.6`))
  // A peer range keeps its operator; a catalog reference follows the catalog.
  assert.equal(plan.files[1].text, core.replace('"^4.0.5"', '"^4.0.6"'))
  assert.deepEqual(plan.bumped.filter((b) => b.file !== "pnpm-workspace.yaml"), [{ file: "packages/core/package.json", name: "effect", from: "^4.0.5", to: "^4.0.6" }])
})

test("planUpgrade moves a Bun workspace's catalog and adds top-level overrides in the file's indentation", () => {
  const root = '{\n\t"name": "monorepo",\n\t"workspaces": {\n\t\t"packages": ["packages/*"],\n\t\t"catalog": {\n\t\t\t"effect": "4.0.1",\n\t\t\t"@effect/sql-sqlite-bun": "4.0.1",\n\t\t\t"@effect/language-service": "0.84.0"\n\t\t}\n\t}\n}\n'
  const plan = planUpgrade([{ path: "package.json", text: root }], "4.0.6", "bun")
  assert.deepEqual(plan.bumped.map((b) => `${b.name} ${b.from} -> ${b.to}`), ["effect 4.0.1 -> 4.0.6", "@effect/sql-sqlite-bun 4.0.1 -> 4.0.6"])
  assert.deepEqual(JSON.parse(plan.files[0].text), {
    name: "monorepo",
    workspaces: { packages: ["packages/*"], catalog: { effect: "4.0.6", "@effect/sql-sqlite-bun": "4.0.6", "@effect/language-service": "0.84.0" } },
    overrides: { effect: "4.0.6", "@effect/sql-sqlite-bun": "4.0.6" }
  })
  assert.ok(plan.files[0].text.includes('\n\t"overrides": {\n\t\t"effect": "4.0.6"'))
})

test("planUpgrade changes nothing at the runtime's version, and needs an effect version", () => {
  assert.deepEqual(planUpgrade([{ path: "package.json", text: '{ "dependencies": { "effect": "4.0.6" } }' }], "4.0.6", "npm").files, [])
  assert.throws(() => planUpgrade([{ path: "package.json", text: '{ "dependencies": { "effect": "catalog:" } }' }], "4.0.6", "pnpm"), /declares no effect version/)
})

// The step itself on a real jj repository with a real Bun suite that the
// upgrade breaks: the upgrade is committed on the base alone, and the broken
// test becomes a setup issue instead of stopping the run.
test("upgrade-effect commits the Effect upgrade on the base and records the tests it breaks as a setup issue", async () => {
  const root = mkdtempSync(join(tmpdir(), "migrate-upgrade-"))
  const target = join(root, "repo")
  const run = join(root, "run")
  const toolchain = join(root, "toolchain")
  try {
    mkdirSync(join(target, "packages/core"), { recursive: true })
    await must("jj git init && jj config set --repo user.name test && jj config set --repo user.email test@localhost", { cwd: target })
    const core = '{\n  "name": "core",\n  "type": "module",\n  "files": ["dist"],\n  "dependencies": { "effect": "catalog:" },\n  "peerDependencies": { "effect": "^4.0.5" }\n}\n'
    writeFileSync(join(target, "package.json"), '{ "name": "fixture", "private": true }\n')
    writeFileSync(join(target, "pnpm-lock.yaml"), "")
    writeFileSync(join(target, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n\ncatalog:\n  effect: 4.0.5\n\noverrides:\n  effect: \"catalog:\"\n")
    writeFileSync(join(target, "packages/core/package.json"), core)
    writeFileSync(join(target, "packages/core/core.test.ts"), 'import { expect, test } from "bun:test"\nimport pkg from "./package.json"\ntest("the peer range", () => expect(pkg.peerDependencies.effect).toBe("^4.0.5"))\n')
    const base = await Jj.commit(target, "base")
    mkdirSync(toolchain)
    writeJson(join(toolchain, "toolchain.json"), { version: "0.0.11", effect: "4.0.6", compiler: "native/vibelang", packages: {} })

    const options = { run, target, packages: ["packages/core"], test: "bun test", testCwd: "packages/core", toolchain, install: "true", base }
    const result = await upgradeEffect(options)
    assert.deepEqual(result.effect, { from: "4.0.5", to: "4.0.6" })
    assert.deepEqual(result.changed, ["pnpm-workspace.yaml", "packages/core/package.json"])
    assert.equal(readFileSync(join(target, "pnpm-workspace.yaml"), "utf8"), "packages:\n  - packages/*\n\ncatalog:\n  effect: 4.0.6\n\noverrides:\n  effect: \"catalog:\"\n")
    assert.equal(readFileSync(join(target, "packages/core/package.json"), "utf8"), core.replace("^4.0.5", "^4.0.6"))

    // One commit on the base, on the run's bookmark, holding only the upgrade.
    assert.equal(await Jj.bookmarkTarget(target, "vibe"), result.jj.commit)
    assert.equal(await Jj.commitId(target, `${result.jj.commit}-`), base)
    const { stdout: subject } = await must(`jj log -r ${result.jj.commit} --no-graph -T 'description.first_line()'`, { cwd: target })
    assert.equal(subject, "migrate(vibelang): upgrade Effect to 4.0.6")

    assert.deepEqual([result.upstreamTests.code, result.tests.code], [0, 1])
    assert.deepEqual(result.regressions.exit, { before: 0, after: 1 })
    const issues = readIssues(paths(run).issues)
    assert.deepEqual(issues.map((i) => [i.entry.batch, i.entry.title, i.problems.length]), [["setup", "Upgrading Effect from 4.0.5 to 4.0.6 makes the target's tests exit 1", 0]])
    assert.equal(readJson(join(paths(run).baseline, "upgraded-tests.json")).code, 1)
    assert.deepEqual(nextStep(run), { step: "setup" })
    assert.deepEqual(await upgradeEffect(options), result)
    assert.deepEqual(await flowStep("upgrade-effect", options), { step: "upgrade-effect", batch: "", summary: "Effect 4.0.5 -> 4.0.6 in 2 files; tests regressed (a setup issue)" })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("upgrade-effect leaves a run that setup already started alone", async () => {
  const run = mkdtempSync(join(tmpdir(), "migrate-upgrade-old-"))
  try {
    writeJson(paths(run).setup, {})
    assert.match((await upgradeEffect({ run })).skipped, /set up before/)
    assert.equal(existsSync(paths(run).upgrade), false)
  } finally {
    rmSync(run, { recursive: true, force: true })
  }
})
