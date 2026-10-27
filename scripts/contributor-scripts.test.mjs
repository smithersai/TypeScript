import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8")

test("example contributors are told how to select nested native compiler calls", () => {
  const header = read("scripts/check-examples.sh").split("set -eu")[0]
  assert.match(header, /VIBELANG=.*native\/vibelang/)
  assert.match(header, /VIBELANG_BINARY=.*native\/vibelang/)
  assert.match(header, /Vite and Vitest/)
})

test("smoke reports the runtime installation prerequisite before building Go", t => {
  const root = mkdtempSync(join(tmpdir(), "vibelang-smoke-prerequisite-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const runtime = join(root, "packages/runtime")
  const tools = join(root, "bin")
  mkdirSync(runtime, { recursive: true })
  mkdirSync(tools)
  writeFileSync(join(runtime, "tsconfig.json"), "{}")
  writeFileSync(join(tools, "go"), '#!/bin/sh\necho "unexpected Go build" >&2\nexit 91\n')
  chmodSync(join(tools, "go"), 0o755)
  const script = join(root, "smoke.sh")
  writeFileSync(script, read("typescript/vibelang/smoke.sh"))
  const result = spawnSync("sh", [script], {
    env: { ...process.env, VIBELANG_RUNTIME: runtime, PATH: tools + ":" + process.env.PATH }, encoding: "utf8"
  })
  assert.equal(result.status, 2, result.stdout + result.stderr)
  assert.match(result.stderr, /missing runtime build dependency @types\/node/)
  assert.ok(result.stderr.includes(`(cd "${runtime}" && bun install --frozen-lockfile)`))
  assert.doesNotMatch(result.stdout + result.stderr, /unexpected Go build/)
})
