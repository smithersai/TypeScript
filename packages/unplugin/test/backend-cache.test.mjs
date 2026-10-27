import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { Writable } from "node:stream"
import webpack from "webpack"
import vibelang from "../src/webpack.js"

const repo = fileURLToPath(new URL("../../../", import.meta.url))

test("webpack tracks the selected backend and compiler without computed-import cache warnings", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "vibelang-webpack-cache-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  await mkdir(join(root, "node_modules"))
  await symlink(join(repo, "packages/compiler"), join(root, "node_modules/vibelang"))
  await writeFile(join(root, "package.json"), '{"type":"module"}')
  await writeFile(join(root, "entry.js"), "export const value = 1\n")
  // No compile is needed, but the selected compiler is a build dependency.
  const binary = join(root, "compiler")
  await writeFile(binary, "compiler identity")
  let log = ""
  const compiler = webpack({
    context: root, mode: "production", entry: "./entry.js",
    output: { path: join(root, "dist") },
    cache: { type: "filesystem", cacheDirectory: join(root, "cache"), buildDependencies: { config: [fileURLToPath(new URL("../src/index.js", import.meta.url))] } },
    infrastructureLogging: { level: "warn", stream: new Writable({ write(chunk, encoding, done) { log += chunk; done() } }) },
    plugins: [vibelang({ compiler: binary })]
  })
  const stats = await new Promise((accept, reject) => compiler.run((error, stats) => error ? reject(error) : accept(stats)))
  await new Promise((accept, reject) => compiler.close(error => error ? reject(error) : accept()))
  assert.equal(stats.hasErrors(), false, stats.toString())
  assert.ok(stats.compilation.buildDependencies.has(join(repo, "packages/compiler/project.mjs")))
  assert.ok(stats.compilation.buildDependencies.has(binary))
  assert.doesNotMatch(log, /Parsing of .*vibelang|Build dependencies behind this expression are ignored/)
})
