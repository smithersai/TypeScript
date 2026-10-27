import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { test } from "node:test"

const root = new URL("../", import.meta.url)
const read = path => readFileSync(new URL(path, root), "utf8")

test("setup instructions address the person following them", () => {
  for (const name of ["existing-project", "vscode", "vite", "vibelang-cli", "react", "vue", "svelte"]) {
    const page = read(`docs/user/src/setup/${name}.md`)
    assert.doesNotMatch(page, /(?:tell|ask) the user|the user's editor/i, name)
  }
})

test("the shipped skill demonstrates Effect 4 config and scoped file IO", () => {
  const skill = read("packages/compiler/skills/vibelang/SKILL.md")
  assert.doesNotMatch(skill, /that reading is never wrong/)
  assert.match(skill, /Config\.withDefault\(Config\.String\("NAME"\), "stranger"\)\(\)/)
  assert.match(skill, /using directory = FileSystem\.makeTempDirectoryScoped\(\)/)
  assert.match(skill, /import "vibelang\/platform\/node"/)
})

test("the current release discloses resource and static platform limits", () => {
  const notes = read("docs/user/src/setup/release-notes.md").split("## 0.0.11")[1]?.split(/^## /m)[0] ?? ""
  const limits = notes.split("### Known limitations")[1]?.split(/^### /m)[0] ?? ""
  for (const text of ["scopes-using-pending-interrupt", "Effect.acquireRelease", "{ value: disposable }", "holder.value", "not a sandbox", "globalThis; g.process.pid", "as any", "Reflect.get", "Intl.DateTimeFormat().format()", "without EK4403"]) {
    assert.ok(limits.includes(text), text)
  }
  for (const path of ["../resource-management/030-scope.md#known-limitation-pending-interruption-and-javascript-disposables", "../platform/platform-globals.md#limits-of-static-checks"]) {
    assert.ok(limits.includes(path), path)
  }
  assert.match(read("docs/user/src/platform/platform-globals.md"), /## Limits of static checks/)
})

test("platform installation follows the canonical exact-version setup", () => {
  const page = read("docs/user/src/platform/105-introduction.md")
  const installs = page.split("## Installing runtime-specific packages")[1]?.split(/^## /m)[0] ?? ""
  assert.ok(installs.includes("../setup/existing-project.md#2-install-the-packages"))
  assert.ok(installs.includes('"@effect/platform-node-shared": "4.0.6"'))
  for (const platform of ["node", "bun", "browser"]) assert.ok(installs.includes(`@effect/platform-${platform}@4.0.6`))
  assert.doesNotMatch(installs, /(?:npm install|bun add|deno add).*@effect\/platform-(?:node|bun|browser)(?!@)[\s\n]/)
})

test("the upgrade table names every DOM type that loses its bare name", () => {
  const notes = read("docs/user/src/setup/release-notes.md")
  const row = notes.split("\n").find(line => line.startsWith("| A DOM type named")) ?? ""
  for (const name of ["Cache", "Console", "Crypto", "FileSystem", "Scheduler", "Transferable", "Worker"]) {
    assert.ok(row.includes("`" + name + "`"), name)
  }
})

test("public guides explain rules without internal decision identifiers", () => {
  const directory = new URL("docs/user/src/", root)
  for (const name of readdirSync(directory, { recursive: true })) {
    if (!String(name).endsWith(".md") || /(?:114-vibelang-for-effect-users|118-experimental-platform-apis)\.md$/.test(String(name))) continue
    let page = read("docs/user/src/" + name).replace(/<!--[\s\S]*?-->/g, "")
    if (name === "setup/release-notes.md") {
      page = page.split("## 0.0.10")[0].split("\n").filter(line => !line.includes("provisional, pending")).join("\n")
    }
    assert.doesNotMatch(page, /\bD\d+\b/, String(name))
  }
  const script = read("scripts/rename-to-vibelang.mjs")
  assert.doesNotMatch(script, /by any lane|Smithers-Ops vault/)
})
