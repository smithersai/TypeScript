import assert from "node:assert/strict"
import { test } from "node:test"
import { addCompilerOptions, addVibeLang, addVitePlugin, effectPins, installCommand, packageManager, pinDependencies, replaceTsc, setIgnoreLine, setJsonOverrides, setYamlOverrides, toolchainSpecs } from "../lib/wire.mjs"

test("effectPins moves effect and its lockstep packages, not separately versioned ones", () => {
  assert.deepEqual(effectPins({ effect: "4.0.0", "@effect/platform-browser": "4.0.0", "@effect/vitest": "^4.0.0", "@effect/tsgo": "0.50.0", "@effect/platform-node": "4.0.0" }, "4.0.6"), {
    effect: "4.0.6", "@effect/platform-browser": "4.0.6", "@effect/vitest": "4.0.6", "@effect/platform-node": "4.0.6", "@effect/platform-node-shared": "4.0.6"
  })
})

const yaml = `packages:
  - 'packages/*'

overrides:
  '@types/node': 26.4.0
  effect: 4.0.0
  '@effect/platform-browser': 4.0.0

  'monaco-editor>dompurify': 3.4.14
other: 1
`

test("setYamlOverrides changes pinned keys in place and adds missing ones inside the block", () => {
  const out = setYamlOverrides(yaml, { effect: "4.0.6", "@effect/platform-browser": "4.0.6", "@effect/vitest": "4.0.6" })
  assert.equal(out, `packages:
  - 'packages/*'

overrides:
  '@types/node': 26.4.0
  effect: 4.0.6
  '@effect/platform-browser': 4.0.6

  'monaco-editor>dompurify': 3.4.14
  '@effect/vitest': 4.0.6
other: 1
`)
  assert.equal(setYamlOverrides("packages:\n  - a\n", { effect: "4.0.6" }), "packages:\n  - a\n\noverrides:\n  effect: 4.0.6\n")
})

test("JSON overrides go under pnpm for pnpm, at the top level otherwise", () => {
  assert.deepEqual(setJsonOverrides({ name: "x" }, { effect: "4.0.6" }, "pnpm"), { name: "x", pnpm: { overrides: { effect: "4.0.6" } } })
  assert.deepEqual(setJsonOverrides({ overrides: { a: "1" } }, { effect: "4.0.6" }, "npm"), { overrides: { a: "1", effect: "4.0.6" } })
})

test("package.json edits: pins, VibeLang packages and tsc in scripts", () => {
  const pkg = { dependencies: { parse5: "^8" }, peerDependencies: { effect: "4.0.0" }, devDependencies: { effect: "4.0.0", vitest: "^5" } }
  const pinned = pinDependencies(pkg, { effect: "4.0.6" })
  assert.deepEqual(pinned.peerDependencies, { effect: "4.0.6" })
  assert.deepEqual(pinned.devDependencies, { effect: "4.0.6", vitest: "^5" })
  assert.equal(pkg.devDependencies.effect, "4.0.0")
  const added = addVibeLang(pinned, { vibelang: "file:/t/v.tgz", "vibelang-runtime": "file:/t/r.tgz", "vibelang-vite": "file:/t/p.tgz" })
  assert.equal(added.dependencies["vibelang-runtime"], "file:/t/r.tgz")
  assert.deepEqual(Object.keys(added.devDependencies), ["effect", "vitest", "vibelang", "vibelang-vite"])
  assert.deepEqual(replaceTsc({ build: "pnpm run clean && tsc -b tsconfig.build.json", typecheck: "tsc -p tsconfig.json --noEmit", test: "vitest run", other: "tscx" }), {
    build: "pnpm run clean && vibelang -b tsconfig.build.json", typecheck: "vibelang -p tsconfig.json --noEmit", test: "vitest run", other: "tscx"
  })
})

const vitestConfig = `import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
  },
})
`

test("addVitePlugin adds the plugin first and once, in the file's quote style", () => {
  const out = addVitePlugin(vitestConfig)
  assert.equal(out, `import { defineConfig } from 'vitest/config'
import vibelang from 'vibelang-vite'

export default defineConfig({
  plugins: [vibelang()],
  test: {
    environment: 'happy-dom',
  },
})
`)
  assert.equal(addVitePlugin(out), out)
  assert.ok(addVitePlugin('import react from "@vitejs/plugin-react"\nexport default defineConfig({ plugins: [react()] })\n').includes("plugins: [vibelang(), react()]"))
  assert.throws(() => addVitePlugin("export default { test: {} }\n"), /defineConfig/)
})

test("addCompilerOptions adds to compilerOptions, or creates it, and keeps options already set", () => {
  assert.equal(addCompilerOptions('{\n  "extends": "./tsconfig.base.json"\n}\n', { rewriteRelativeImportExtensions: true }),
    '{\n  "compilerOptions": {\n    "rewriteRelativeImportExtensions": true\n  },\n  "extends": "./tsconfig.base.json"\n}\n')
  assert.equal(addCompilerOptions('{\n  "compilerOptions": {\n    "noEmit": false\n  }\n}\n', { rewriteRelativeImportExtensions: true }),
    '{\n  "compilerOptions": {\n    "rewriteRelativeImportExtensions": true,\n    "noEmit": false\n  }\n}\n')
  const set = '{ "compilerOptions": { "rewriteRelativeImportExtensions": false } }'
  assert.equal(addCompilerOptions(set, { rewriteRelativeImportExtensions: true }), set)
  assert.equal(addCompilerOptions("{}", { a: 1 }), '{\n  "compilerOptions": {\n    "a": 1\n  }\n}')
})

test("packageManager reads the lockfile", () => {
  assert.equal(packageManager(["pnpm-lock.yaml", "package.json"]), "pnpm")
  assert.equal(packageManager(["bun.lock"]), "bun")
  assert.equal(packageManager(["package.json"]), "npm")
  assert.equal(installCommand("pnpm"), "pnpm install --no-frozen-lockfile")
})

test("a staged toolchain's specifiers are relative to each package, into the ignored root directory", () => {
  const tarballs = { vibelang: "vibelang-0.0.11.tgz", "vibelang-runtime": "vibelang-runtime-0.0.11.tgz" }
  assert.deepEqual(toolchainSpecs("packages/foldkit", tarballs), {
    vibelang: "file:../../.vibelang-toolchain/vibelang-0.0.11.tgz",
    "vibelang-runtime": "file:../../.vibelang-toolchain/vibelang-runtime-0.0.11.tgz"
  })
  assert.equal(toolchainSpecs(".", tarballs).vibelang, "file:./.vibelang-toolchain/vibelang-0.0.11.tgz")
  assert.equal(toolchainSpecs("apps/web/", tarballs).vibelang, "file:../../.vibelang-toolchain/vibelang-0.0.11.tgz")
})

test("setIgnoreLine adds the toolchain directory once and removes it for a published version", () => {
  assert.equal(setIgnoreLine("node_modules\ndist", ".vibelang-toolchain/", true), "node_modules\ndist\n.vibelang-toolchain/\n")
  assert.equal(setIgnoreLine("", ".vibelang-toolchain/", true), ".vibelang-toolchain/\n")
  const added = setIgnoreLine("node_modules\n", ".vibelang-toolchain/", true)
  assert.equal(setIgnoreLine(added, ".vibelang-toolchain/", true), added)
  assert.equal(setIgnoreLine(added, ".vibelang-toolchain/", false), "node_modules\n")
  assert.equal(setIgnoreLine("node_modules\n", ".vibelang-toolchain/", false), "node_modules\n")
})
