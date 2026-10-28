import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { fixture, prepareBuilds, run, scaffold } from "./options-build.mjs"

test("Yarn Classic installs a default scaffold and runs its source tests", { timeout: 180_000 }, (t) => {
  const f = fixture()
  t.after(f.cleanup)
  const input = { source: "checkout", manager: "yarn", noInstall: false, noGit: false, state: "new", name: "app" }
  const prepared = prepareBuilds(f, [input])
  const yarn = prepared.executables.yarn
  const version = run(yarn, ["--version"], f.directory, prepared.env, "Yarn Classic version")
  assert.equal(version.status, 0, version.output)
  assert.match(version.stdout.trim(), /^1\./, "this regression requires Yarn Classic")

  const created = scaffold(f, input, f.directory, prepared.env)
  assert.equal(created.status, 0, created.output)
  const app = join(f.directory, input.name)
  assert.ok(!existsSync(join(app, "dist")), "tests run directly from source before a build")
  const tested = run(yarn, ["run", "test"], app, prepared.env, "Yarn Classic source tests")
  assert.equal(tested.status, 0, tested.output)
  assert.match(tested.output, /2 passed/)
})
