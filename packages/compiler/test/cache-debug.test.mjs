import { strict as assert } from "node:assert"
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { projectCache } from "../cache.mjs"

test("a source edited before compilation reports the cache timestamp safety margin", (t) => {
  const root = mkdtempSync(join(tmpdir(), "vibelang-cache-debug-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const project = join(root, "tsconfig.json")
  const source = join(root, "source.ts")
  writeFileSync(project, "{}")
  writeFileSync(source, "export const value = 1")
  const messages = []
  const cache = projectCache({ project, root, compiler: process.execPath,
    cache: { directory: join(root, "cache") }, debug: (message) => messages.push(message) })
  const snapshot = cache.begin()
  assert.ok(snapshot)
  // Fix the timestamp within the safety margin, strictly before the snapshot,
  // so scheduler delays cannot turn this into a non-racy file.
  const edited = new Date(snapshot.started - 10)
  utimesSync(source, edited, edited)
  cache.store(snapshot, { outputs: new Map(), errors: [], warnings: [] }, [source])
  assert.deepEqual(messages, [`not caching ${project}: ${source} changed during or too close to the compile`])
  assert.equal(existsSync(cache.file), false)
})
