import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

test("CLI reference watch distinguishes selected inputs from the reference graph", () => {
  const text = read("docs/user/src/setup/vibelang-cli.md")
  assert.match(text, /vibelang -b -w/)
  assert.match(text, /selected project/)
})

test("both Bun loader entry points disclose the observed watch limit and dev alternative", () => {
  for (const path of ["packages/compiler/README.md", "docs/user/src/setup/vibelang-cli.md"]) {
    const text = read(path)
    assert.match(text, /Bun 1\.4\.1.*`bun --watch --preload vibelang\/bun`/)
    assert.match(text, /does not reliably restart/)
    assert.match(text, /bun run dev/)
  }
})

test("Bun test instructions install and enable declarations before running Effects", () => {
  for (const path of ["packages/compiler/README.md", "docs/user/src/setup/vibelang-cli.md"]) {
    const text = read(path)
    for (const part of ["bun add -d @types/bun", '"types": ["bun"]', '[test]', 'preload = ["vibelang/bun"]', 'from "bun:test"', "Effect.runSync(greeting("]) assert.ok(text.includes(part), part)
  }
})

test("runtime export table covers every built JavaScript root export", async (t) => {
  let runtime
  try { runtime = await import("../../packages/runtime/dist/index.js") }
  catch (error) { if (error.code === "ERR_MODULE_NOT_FOUND") return t.skip("build packages/runtime first"); throw error }
  const table = read("packages/runtime/README.md").split("## Public exports")[1].split(/\n## /)[0]
  for (const name of Object.keys(runtime)) assert.ok(table.includes(`\`${name}\``), `undocumented root export: ${name}`)
})

test("CLI documents configuration tools and the initializer's ESM boundary", () => {
  const text = read("docs/user/src/setup/vibelang-cli.md")
  for (const part of ["--init", "--showConfig", "--ignoreConfig", '"type": "module"', "generic"]) assert.ok(text.includes(part), part)
})

test("editor setup names the registered discovery and editing capabilities", () => {
  const text = read("docs/user/src/setup/vscode.md").toLowerCase()
  for (const part of ["call hierarchy", "type definition", "workspace symbols", "signature help", "selection ranges", "document highlights", "inlay hints", "code lens", "linked editing", "on-type formatting"]) assert.ok(text.includes(part), part)
})

test("published editor setup exposes the shipped server controls", () => {
  const text = read("docs/user/src/setup/vscode.md")
  const manifest = JSON.parse(read("editors/vscode/package.json"))
  for (const key of ["vibelang.server.path", "vibelang.server.typeScriptFiles", "vibelang.trace.server"]) {
    assert.ok(manifest.contributes.configuration.properties[key])
    assert.ok(text.includes(key), key)
  }
  for (const part of ["VibeLang: Restart Language Server", "VibeLang: Show Language Server Output", '"messages"', '"verbose"']) assert.ok(text.includes(part), part)
})

test("scaffolder options include both aliases for help and version", () => {
  const text = read("packages/create-vibelang/README.md")
  for (const flag of ["-h", "--help", "-v", "--version"]) assert.ok(text.includes(`\`${flag}\``), flag)
})
