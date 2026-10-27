import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { test } from "node:test"

const repo = fileURLToPath(new URL("../../../", import.meta.url))
const native = process.env.VIBELANG_BINARY || join(repo, "typescript/built/local/tsc")
const effect = join(process.env.EFFECT_NODE_MODULES || join(repo, "experiments/node_modules"), "effect")
const missing = [native, effect, join(repo, "packages/runtime/dist/index.js")].find(path => !existsSync(path))

test("watch assertions wait past an intermediate empty build for the edited revision", {
  skip: missing && `run typescript/vibelang/smoke.sh first; missing ${missing}`, timeout: 60000
}, () => {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, [
    "--import", fileURLToPath(new URL("./fixtures/watch-intermediate.mjs", import.meta.url)),
    "--test", fileURLToPath(new URL("./watch-warning.test.mjs", import.meta.url))
  ], { env, encoding: "utf8", timeout: 50000 })
  assert.equal(result.status, 0, result.stdout + result.stderr)
  assert.match(result.stdout, /pass 1/)
})
