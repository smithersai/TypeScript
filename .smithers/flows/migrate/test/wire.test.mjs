import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"
import { loadTypeScript } from "../lib/declarations.mjs"
import { addCompilerOptions, addVibeLang, addVitePlugin, effectPins, installCommand, packageManager, pinDependencies, replaceTsc, setIgnoreLine, setJsonOverrides, setYamlOverrides, testConfigArgument, toolchainSpecs, wireVite } from "../lib/wire.mjs"

// The runtime package's TypeScript (bun install in packages/runtime) has the compiler API.
const ts = loadTypeScript([fileURLToPath(new URL("../../../../packages/runtime/", import.meta.url))])

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
  const out = addVitePlugin(vitestConfig, ts)
  assert.equal(out, `import { defineConfig } from 'vitest/config'
import vibelang from 'vibelang-vite'

export default defineConfig({
  plugins: [vibelang()],
  test: {
    environment: 'happy-dom',
  },
})
`)
  assert.equal(addVitePlugin(out, ts), out)
  assert.ok(addVitePlugin('import react from "@vitejs/plugin-react"\nexport default defineConfig({ plugins: [react()] })\n', ts).includes("plugins: [vibelang(), react()]"))
  assert.throws(() => addVitePlugin("export default { test: {} }\n", ts), /defineConfig/)
})

// A monorepo's shared config, shaped like t3code's: its lint options have a
// plugins list of their own, which is not Vite's.
const sharedConfig = `import "vite-plus/test/config";
import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
  },
  lint: {
    plugins: ["eslint", "oxc"],
  },
});
`

test("addVitePlugin adds the config's own plugins, never a nested option's, with the file's semicolons", () => {
  assert.equal(addVitePlugin(sharedConfig, ts), `import "vite-plus/test/config";
import { defineConfig } from "vite-plus";
import vibelang from "vibelang-vite";

export default defineConfig({
  plugins: [vibelang()],
  test: {
    environment: "node",
  },
  lint: {
    plugins: ["eslint", "oxc"],
  },
});
`)
  assert.equal(addVitePlugin("export default defineConfig({ plugins: [] })\n", ts), 'import vibelang from "vibelang-vite"\nexport default defineConfig({ plugins: [vibelang()] })\n')
  assert.throws(() => addVitePlugin("export default defineConfig({ plugins })\n", ts), /not an array literal/)
})

test("testConfigArgument reads --config and -c from the command or the package script it runs", () => {
  assert.equal(testConfigArgument("vp test run --config ../../vite.config.ts --dir ."), "../../vite.config.ts")
  assert.equal(testConfigArgument("vitest run --config=vitest.shared.ts"), "vitest.shared.ts")
  assert.equal(testConfigArgument("vitest run -c 'configs/vitest.ts'"), "configs/vitest.ts")
  assert.equal(testConfigArgument("pnpm test", { test: "vp test run --config ../../vite.config.ts --dir ." }), "../../vite.config.ts")
  assert.equal(testConfigArgument("bun run test:unit", { "test:unit": "vitest run -c ../shared.ts" }), "../shared.ts")
  assert.equal(testConfigArgument("pnpm exec vitest run", { test: "vitest run --config other.ts" }), null)
  assert.equal(testConfigArgument("bun test"), null)
})

// t3code: packages/contracts runs its tests with the repository's shared
// config, so the package itself has no config to wire.
test("wireVite wires the shared config the test command names, and gives its package the plugin", () => {
  const root = mkdtempSync(join(tmpdir(), "migrate-vite-"))
  try {
    mkdirSync(join(root, "packages/contracts"), { recursive: true })
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "monorepo", private: true, devDependencies: { "vite-plus": "1.4.0" } }, null, 2) + "\n")
    writeFileSync(join(root, "vite.config.ts"), sharedConfig)
    writeFileSync(join(root, "packages/contracts/package.json"), JSON.stringify({ name: "contracts", scripts: { test: "vp test run --config ../../vite.config.ts --dir ." } }, null, 2) + "\n")
    const specsFor = (dir) => toolchainSpecs(dir, { vibelang: "vibelang-0.0.11.tgz", "vibelang-vite": "vibelang-vite-0.0.11.tgz" })
    const packages = [{ dir: "packages/contracts" }]
    for (const command of ["vp test run --config ../../vite.config.ts --dir . --maxWorkers=8", "pnpm test"]) {
      writeFileSync(join(root, "vite.config.ts"), sharedConfig)
      const wired = wireVite({ root, packages, test: { command, cwd: "packages/contracts" }, ts, specsFor })
      assert.deepEqual(wired.configs, ["vite.config.ts"])
      assert.deepEqual(wired.warnings, [])
      assert.ok(readFileSync(join(root, "vite.config.ts"), "utf8").includes('defineConfig({\n  plugins: [vibelang()],\n  test:'))
      assert.deepEqual(JSON.parse(readFileSync(join(root, "package.json"), "utf8")).devDependencies, {
        "vite-plus": "1.4.0",
        vibelang: "file:./.vibelang-toolchain/vibelang-0.0.11.tgz",
        "vibelang-vite": "file:./.vibelang-toolchain/vibelang-vite-0.0.11.tgz"
      })
    }
    assert.throws(() => wireVite({ root, packages, test: { command: "vitest run --config missing.ts", cwd: "packages/contracts" }, ts, specsFor }), /missing.ts .* is not a file of the target/)

    // Without --config, each package's own config is wired, and a package without one is named.
    writeFileSync(join(root, "packages/contracts/vitest.config.ts"), vitestConfig)
    mkdirSync(join(root, "packages/other"))
    writeFileSync(join(root, "packages/other/package.json"), "{}\n")
    const own = wireVite({ root, packages: [...packages, { dir: "packages/other" }], test: { command: "vitest run", cwd: "." }, ts, specsFor })
    assert.deepEqual(own.configs, ["packages/contracts/vitest.config.ts"])
    assert.deepEqual(own.changed, ["packages/contracts/vitest.config.ts", "packages/contracts/package.json"])
    assert.match(own.warnings[0], /^packages\/other: no Vite or Vitest config/)
    assert.equal(JSON.parse(readFileSync(join(root, "packages/contracts/package.json"), "utf8")).devDependencies.vibelang, "file:../../.vibelang-toolchain/vibelang-0.0.11.tgz")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
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
