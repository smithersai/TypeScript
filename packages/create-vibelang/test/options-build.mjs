// S1 real builds: FC_SCAFFOLD_ALL=1 enumerates the entire matrix (nightly).
// Default discovery builds two representatives; FC_RUNS raises that count.
import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const root = fileURLToPath(new URL("../../../", import.meta.url))
export const version = JSON.parse(readFileSync(new URL("../package.json", import.meta.url))).version
export const managers = ["npm", "bun", "pnpm", "yarn"]
export const combinations = ["checkout", "packed"].flatMap(source => managers.flatMap(manager =>
  [false, true].flatMap(noInstall => [false, true].flatMap(noGit =>
    ["new", "empty"].map(state => ({ source, manager, noInstall, noGit, state }))))))
export let diagnostics = ""
export let failureDiagnostics = ""
export let savedFiles = {}
const trace = text => { diagnostics = (diagnostics + text + "\n").slice(-12000) }

export function run(command, args, cwd, env, stage, timeout = 120000) {
  trace(stage)
  const result = spawnSync(command, args, { cwd, env, encoding: "utf8", timeout, maxBuffer: 2 << 20 })
  trace(`${stage}: status=${result.status} signal=${result.signal}\n${result.stdout || ""}\n${result.stderr || ""}`)
  assert.ifError(result.error)
  assert.equal(result.signal, null, `${stage}: signal=${result.signal}`)
  return { ...result, output: result.stdout + result.stderr }
}

export function tree(directory, excludeGenerated = true) {
  const files = {}
  function visit(base, prefix = "") {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (excludeGenerated && ["node_modules", "dist", ".vibe", ".git", "bun.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"].includes(entry.name)) continue
      const name = prefix + entry.name, path = join(base, entry.name)
      if (entry.isDirectory()) visit(path, name + "/")
      else files[name] = readFileSync(path, "utf8")
    }
  }
  visit(directory)
  return files
}

export function pins(app) {
  const manifest = JSON.parse(readFileSync(join(app, "package.json")))
  assert.equal(manifest.dependencies["vibelang-runtime"], version)
  for (const name of ["vibelang", "vibelang-vite"]) assert.equal(manifest.devDependencies[name], version)
}

export function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "vibelang-S1-"))
  const env = { ...process.env, NO_COLOR: "1", npm_config_cache: join(directory, "cache/npm"),
    BUN_INSTALL_CACHE_DIR: join(directory, "cache/bun"), YARN_CACHE_FOLDER: join(directory, "cache/yarn") }
  const stage = join(directory, "stage")
  mkdirSync(stage)
  cpSync(join(root, "packages/create-vibelang/bin"), join(stage, "bin"), { recursive: true })
  cpSync(join(root, "packages/create-vibelang/package.json"), join(stage, "package.json"))
  cpSync(join(root, "templates/app"), join(stage, "template"), { recursive: true,
    filter: path => !["node_modules", "dist", ".vibe"].includes(path.split("/").at(-1)) })
  // Match scripts/release/make-packages.mjs: npm omits .gitignore otherwise.
  for (const name of [".gitignore", ".gitattributes"]) if (existsSync(join(stage, "template", name))) {
    renameSync(join(stage, "template", name), join(stage, "template", name.slice(1)))
  }
  const pack = run("npm", ["pack", "--ignore-scripts", "--json", "--silent", "--pack-destination", directory], stage, env, "pack scaffolder")
  assert.equal(pack.status, 0, pack.output)
  const unpack = run("tar", ["-xzf", join(directory, JSON.parse(pack.stdout)[0].filename), "-C", directory], directory, env, "unpack scaffolder")
  assert.equal(unpack.status, 0, unpack.output)
  return { directory, env, cli: source => source === "packed"
    ? join(directory, "package/bin/create-vibelang.mjs") : join(root, "packages/create-vibelang/bin/create-vibelang.mjs"),
    cleanup: () => rmSync(directory, { recursive: true, force: true }) }
}

export function scaffold(f, input, cwd, env = f.env) {
  const args = [f.cli(input.source), input.name]
  if (input.noInstall) args.push("--no-install")
  if (input.noGit) args.push("--no-git")
  return run(process.execPath, args, cwd, { ...env, npm_config_user_agent: `${input.manager}/99.0.0` }, `scaffold ${JSON.stringify(input)}`)
}

export function capture(app, error) {
  savedFiles = existsSync(app) ? Object.fromEntries(Object.entries(tree(app)).map(([name, text]) => ["project/" + name, text])) : {}
  trace(error.stack)
  failureDiagnostics = diagnostics
}

export function prepareBuilds(f, selected) {
  const compiler = resolve(process.env.VIBELANG_BINARY || join(root, "typescript/built/local/tsc"))
  assert.ok(existsSync(compiler), "S1 setup: build compiler on the build host or set VIBELANG_BINARY")
  assert.ok(existsSync(join(root, "packages/runtime/dist/index.js")), "S1 setup: build packages/runtime first")
  const executables = {}
  for (const manager of new Set(selected.map(input => input.manager))) {
    const found = run("sh", ["-c", 'command -v "$1"', "sh", manager], root, f.env, `locate ${manager}`)
    assert.equal(found.status, 0, `S1 setup: install ${manager} before running this lane`)
    executables[manager] = found.stdout.trim()
  }
  const tarballs = {}
  for (const [name, path] of [["vibelang", "compiler"], ["vibelang-runtime", "runtime"], ["vibelang-vite", "vite"]]) {
    let source = join(root, "packages", path)
    if (name === "vibelang") {
      const staged = join(f.directory, "compiler"), manifest = JSON.parse(readFileSync(join(source, "package.json")))
      mkdirSync(staged)
      for (const file of ["package.json", ...manifest.files]) if (existsSync(join(source, file))) {
        cpSync(join(source, file), join(staged, file), { recursive: true })
      }
      // VIBELANG_BINARY supplies the checkout's native compiler. Only this
      // temporary tarball omits registry platform dependencies: unreleased
      // checkout versions must be testable without a prior npm publication.
      delete manifest.optionalDependencies
      writeFileSync(join(staged, "package.json"), JSON.stringify(manifest, null, 2) + "\n")
      source = staged
    }
    const packed = run("npm", ["pack", source, "--ignore-scripts", "--pack-destination", f.directory, "--json", "--silent"], root, f.env, `pack ${name}`)
    assert.equal(packed.status, 0, packed.output)
    tarballs[name] = `file:${join(f.directory, JSON.parse(packed.stdout)[0].filename)}`
  }
  // The CLI still invokes the selected real manager with exactly "install".
  // Substitute only the three already-checked pins with prepacked checkout dependencies.
  const bin = join(f.directory, "installers")
  mkdirSync(bin)
  for (const [manager, executable] of Object.entries(executables)) {
    const flags = manager === "pnpm" ? ["--store-dir", join(f.directory, "cache/pnpm")]
      : manager === "yarn" ? ["--non-interactive"] : []
    writeFileSync(join(bin, manager), `#!${process.execPath}
import { readFileSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
const manifest = JSON.parse(readFileSync("package.json"))
const local = ${JSON.stringify(tarballs)}
for (const [name, value] of Object.entries(local)) {
  const section = name === "vibelang-runtime" ? "dependencies" : "devDependencies"
  if (manifest[section][name] !== ${JSON.stringify(version)}) throw new Error("unexpected pin: " + name)
  manifest[section][name] = value
}
writeFileSync("package.json", JSON.stringify(manifest, null, 2) + "\\n")
const result = spawnSync(${JSON.stringify(executable)}, ["install", ...${JSON.stringify(flags)}], { stdio: "inherit" })
if (result.error) throw result.error
process.exit(result.status ?? 1)
`, { mode: 0o755 })
  }
  return { executables, env: { ...f.env, VIBELANG_BINARY: compiler, PATH: `${bin}:${process.env.PATH}` }, bin }
}

// docs/user/src/setup/new-project.md §§1–3 and Chapter 28, Building and testing:
// every option combination produces an installable, checkable, runnable starter.
export function checkBuild(f, prepared, input) {
  const directory = mkdtempSync(join(f.directory, "build-")), app = join(directory, input.name)
  diagnostics = ""
  process.stderr.write(`S1 build ${JSON.stringify(input)}\n`)
  try {
    if (input.state === "empty") mkdirSync(app)
    const created = scaffold(f, input, directory, prepared.env)
    assert.equal(created.status, 0, created.output)
    if (input.noInstall) {
      pins(app)
      const installed = run(join(prepared.bin, input.manager), ["install"], app, prepared.env, "explicit install after --no-install")
      assert.equal(installed.status, 0, installed.output)
    }
    const check = run(process.execPath, [join(app, "node_modules/vibelang/bin/vibelang"), "--noEmit"], app, prepared.env, "type-check")
    assert.equal(check.status, 0, check.output)
    const manager = prepared.executables[input.manager]
    // Source tests must work before emitted files exist, as the guide promises.
    assert.ok(!existsSync(join(app, "dist")))
    const tested = run(manager, ["run", "test"], app, prepared.env, "source tests")
    assert.equal(tested.status, 0, tested.output)
    assert.match(tested.output, /2 passed/)
    const built = run(manager, ["run", "build"], app, prepared.env, "build")
    assert.equal(built.status, 0, built.output)
    const started = run(manager, ["run", "start"], app, prepared.env, "start")
    assert.equal(started.status, 0, started.output)
    assert.match(started.output, /Hello, VibeLang!\s+Recovered from EmptyName/)
    process.stderr.write(`S1 PASS ${JSON.stringify(input)}\n`)
  } catch (error) {
    capture(app, error)
    process.stderr.write(`S1 FAIL ${JSON.stringify(input)}: ${error.message.slice(-1800)}\n`)
    throw error
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}
