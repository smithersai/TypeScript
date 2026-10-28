// Typed lint of .ts files that import VibeLang modules. typescript-eslint's
// own program, from the typescript it installs, cannot read a .vibe file, so
// a type from one reaches a .ts file unresolved and type-aware rules report
// code that vibelang -p accepts. typedProgram's program reads each .vibe
// module's declaration instead: the .ts file sees the types the compiler sees.
import { strict as assert } from "node:assert"
import { mkdirSync, rmSync, symlinkSync } from "node:fs"
import { test } from "node:test"
import { ESLint } from "eslint"
import tseslint from "typescript-eslint"
import { typedProgram } from "../../eslint.mjs"

const cwd = new URL("./fixtures/typed/", import.meta.url).pathname
const rules = {
  "@typescript-eslint/no-unnecessary-type-assertion": "error",
  "@typescript-eslint/no-unsafe-argument": "error",
  "@typescript-eslint/no-unsafe-assignment": "error",
  "@typescript-eslint/no-unsafe-call": "error",
  "@typescript-eslint/no-unsafe-member-access": "error",
  "@typescript-eslint/no-unsafe-return": "error",
  "@typescript-eslint/restrict-template-expressions": "error"
}

const lint = async (parserOptions) => {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ["src/**/*.ts"],
      languageOptions: { parser: tseslint.parser, parserOptions },
      plugins: { "@typescript-eslint": tseslint.plugin },
      rules
    }]
  })
  const results = await eslint.lintFiles(["src/control.ts", "src/subject.ts"])
  return Object.fromEntries(results.map((result) => [
    result.filePath.slice(cwd.length),
    result.messages.map((message) => `${message.line}:${message.column} ${message.ruleId ?? message.message}`)
  ]))
}

test("typescript-eslint's own program reads a .vibe module's types as unresolved", async () => {
  const found = await lint({ project: "./tsconfig.json", tsconfigRootDir: cwd })
  assert.deepEqual(found["src/control.ts"], [])
  assert.ok(found["src/subject.ts"].includes("4:71 @typescript-eslint/no-unnecessary-type-assertion"), found["src/subject.ts"].join("\n"))
})

test("typedProgram gives .ts files the types of the .vibe modules they import", async () => {
  const found = await lint({ programs: [typedProgram({ project: "tsconfig.json", tsconfigRootDir: cwd })] })
  assert.deepEqual(found, {
    "src/control.ts": [],
    "src/subject.ts": ["9:48 @typescript-eslint/no-unnecessary-type-assertion"]
  })
})

test("typedProgram's program type-checks the project as vibelang -p does", () => {
  const program = typedProgram({ project: "tsconfig.json", tsconfigRootDir: cwd })
  const subject = program.getSourceFile(`${cwd}src/subject.ts`)
  assert.deepEqual(program.getSemanticDiagnostics(subject).map((diagnostic) => diagnostic.messageText), [])
  const read = program.getSourceFiles().map((file) => file.fileName.slice(cwd.length)).filter((name) => name.startsWith("src/"))
  assert.deepEqual(read.sort(), ["src/chain.d.vibe.ts", "src/control.ts", "src/plain.ts", "src/plainBarrel.ts", "src/subject.ts", "src/vibe.d.vibe.ts", "src/vibeBarrel.ts"])
})

test("another workspace package's .vibe modules compile with that package's project", async () => {
  const workspace = new URL("./fixtures/typed-workspace/", import.meta.url).pathname
  const app = `${workspace}app/`
  // The link pnpm makes for a workspace dependency; node_modules is not committed.
  mkdirSync(`${app}node_modules/@typed`, { recursive: true })
  rmSync(`${app}node_modules/@typed/lib`, { force: true })
  symlinkSync("../../../lib", `${app}node_modules/@typed/lib`)
  const program = typedProgram({ project: "tsconfig.json", tsconfigRootDir: app })
  const main = program.getSourceFile(`${app}src/main.ts`)
  assert.deepEqual(program.getSemanticDiagnostics(main).map((diagnostic) => diagnostic.messageText), [])
  const eslint = new ESLint({
    cwd: app,
    overrideConfigFile: true,
    overrideConfig: [{
      files: ["src/**/*.ts"],
      languageOptions: { parser: tseslint.parser, parserOptions: { programs: [program] } },
      plugins: { "@typescript-eslint": tseslint.plugin },
      rules
    }]
  })
  const [result] = await eslint.lintFiles(["src/main.ts"])
  assert.deepEqual(result.messages.map((message) => `${message.line}:${message.column} ${message.ruleId ?? message.message}`), [])
})
