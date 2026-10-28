import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"
import { test } from "node:test"
import { fixture, prepareBuilds, run, scaffold } from "./options-build.mjs"

test("Yarn Classic installs a default scaffold, tests, builds, and starts without Redis", { timeout: 180_000 }, (t) => {
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

  // Classic leaves platform-node's Redis peer uninstalled. npm installs it,
  // which masks an entry that imports NodeRuntime from the platform barrel.
  const require = createRequire(join(app, "package.json"))
  assert.throws(() => require.resolve("redis"), { code: "MODULE_NOT_FOUND" })
  const built = run(yarn, ["run", "build"], app, prepared.env, "Yarn Classic build")
  assert.equal(built.status, 0, built.output)
  assert.match(readFileSync(join(app, "README.md"), "utf8"), /yarn run start/)
  const started = run(yarn, ["run", "start"], app, prepared.env, "Yarn Classic documented start")
  assert.equal(started.status, 0, started.output)
  assert.match(started.output, /Hello, VibeLang!\s+Recovered from EmptyName/)
})
