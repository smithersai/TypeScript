// The edits that set up VibeLang in an existing project, as text-in,
// text-out functions: the package's dependencies, Effect pinned to the
// version the runtime requires, tsc replaced by vibelang in scripts, the
// vibelang-vite plugin in the Vitest or Vite config, and the compiler option
// that lets .vibe files import local modules by their source names. Each
// keeps the file's own formatting outside the lines it changes.

/** Whether an @effect/* package is released with effect itself, judged by its pinned version matching effect's. */
export const lockstep = (name, version, effectVersion) =>
  name === "effect" || (name.startsWith("@effect/") && version === effectVersion)

/** The Effect packages to pin to `to`: effect, every @effect/* package pinned at effect's own version, and the platform-node-shared pin VibeLang's install requires. */
export function effectPins(declared, to) {
  const from = declared.effect
  const pins = { effect: to }
  for (const [name, version] of Object.entries(declared)) {
    if (name !== "effect" && lockstep(name, String(version).replace(/^[\^~]/, ""), String(from).replace(/^[\^~]/, ""))) pins[name] = to
  }
  if (pins["@effect/platform-node"]) pins["@effect/platform-node-shared"] = to
  return pins
}

const yamlKey = (name) => (/^[A-Za-z0-9_-]+$/.test(name) ? name : `'${name}'`)

/**
 * Sets keys of the top-level `overrides:` map in a pnpm-workspace.yaml,
 * adding the block when there is none. Other keys and lines are kept.
 */
export function setYamlOverrides(text, pins) {
  const lines = text.split("\n")
  let start = lines.findIndex((l) => /^overrides:\s*$/.test(l))
  if (start < 0) {
    const body = Object.entries(pins).map(([k, v]) => `  ${yamlKey(k)}: ${v}`)
    return text.replace(/\n*$/, "\n") + `\noverrides:\n${body.join("\n")}\n`
  }
  let end = start + 1
  while (end < lines.length && (/^\s+\S/.test(lines[end]) || lines[end].trim() === "")) end++
  while (end > start + 1 && lines[end - 1].trim() === "") end--
  const seen = new Set()
  for (let i = start + 1; i < end; i++) {
    const m = /^(\s+)(['"]?)([^'":]+)\2:\s*(.*)$/.exec(lines[i])
    if (m && m[3] in pins) {
      lines[i] = `${m[1]}${m[2]}${m[3]}${m[2]}: ${pins[m[3]]}`
      seen.add(m[3])
    }
  }
  const missing = Object.entries(pins).filter(([k]) => !seen.has(k)).map(([k, v]) => `  ${yamlKey(k)}: ${v}`)
  lines.splice(end, 0, ...missing)
  return lines.join("\n")
}

/** Sets top-level `overrides` (npm, Bun) or `pnpm.overrides` in a package.json object. */
export function setJsonOverrides(pkg, pins, manager) {
  const next = structuredClone(pkg)
  const holder = manager === "pnpm" ? (next.pnpm ??= {}) : next
  holder.overrides = { ...holder.overrides, ...pins }
  return next
}

/** Replaces tsc with vibelang in package scripts: `tsc -b x` becomes `vibelang -b x`. */
export function replaceTsc(scripts = {}) {
  const next = {}
  for (const [name, command] of Object.entries(scripts)) next[name] = command.replace(/(^|[\s;&|(])tsc(?=\s|$)/g, "$1vibelang")
  return next
}

/** Pins Effect dependencies at `pins` in every dependency field where they appear. */
export function pinDependencies(pkg, pins) {
  const next = structuredClone(pkg)
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const name of Object.keys(next[field] ?? {})) if (name in pins) next[field][name] = pins[name]
  }
  return next
}

/** Adds the VibeLang packages: the runtime as a dependency, the compiler and plugin as dev dependencies. */
export function addVibeLang(pkg, specs) {
  const next = structuredClone(pkg)
  next.dependencies = { ...next.dependencies, "vibelang-runtime": specs["vibelang-runtime"] }
  next.devDependencies = { ...next.devDependencies, vibelang: specs.vibelang, "vibelang-vite": specs["vibelang-vite"] }
  return next
}

/**
 * Adds `vibelang()` from vibelang-vite to a Vite or Vitest config that calls
 * defineConfig with an object literal, first in its plugins. Returns the text
 * unchanged when the plugin is already there; throws when the config has a
 * shape this edit does not know, so a person wires it instead.
 */
export function addVitePlugin(text) {
  if (/from\s+['"]vibelang-vite['"]/.test(text)) return text
  const quote = /from\s+'/.test(text) ? "'" : '"'
  const lastImport = [...text.matchAll(/^import\s[\s\S]*?from\s+['"][^'"]+['"][^\S\n]*\n/gm)].at(-1)
  const at = lastImport ? lastImport.index + lastImport[0].length : 0
  const out = text.slice(0, at) + `import vibelang from ${quote}vibelang-vite${quote}\n` + text.slice(at)
  if (/\bplugins\s*:\s*\[/.test(out)) return out.replace(/\bplugins\s*:\s*\[/, (m) => `${m}vibelang(), `)
  const call = /defineConfig\(\s*\{/.exec(out)
  if (!call) throw new Error("the config does not call defineConfig({ ... }); add vibelang() from vibelang-vite to its plugins by hand")
  const after = call.index + call[0].length
  const indent = /\n([ \t]+)\S/.exec(out.slice(after))?.[1] ?? "  "
  return out.slice(0, after) + `\n${indent}plugins: [vibelang()],` + out.slice(after)
}

/**
 * Adds compiler options to a tsconfig's text (JSON with comments): into its
 * compilerOptions when it has them, else as a new compilerOptions object.
 * Options already set are left as they are.
 */
export function addCompilerOptions(text, options) {
  const entries = Object.entries(options).filter(([k]) => !new RegExp(`"${k}"\\s*:`).test(text))
  if (!entries.length) return text
  const body = (indent) => entries.map(([k, v]) => `${indent}"${k}": ${JSON.stringify(v)}`).join(",\n")
  const existing = /"compilerOptions"\s*:\s*\{/.exec(text)
  if (existing) {
    const after = existing.index + existing[0].length
    const rest = text.slice(after)
    const indent = /\n([ \t]+)\S/.exec(rest)?.[1] ?? "    "
    const empty = /^\s*\}/.test(rest)
    return text.slice(0, after) + `\n${body(indent)}${empty ? "\n" : ","}` + rest
  }
  const open = text.indexOf("{")
  if (open < 0) throw new Error("not a tsconfig object")
  const rest = text.slice(open + 1)
  const indent = /\n([ \t]+)\S/.exec(rest)?.[1] ?? "  "
  const empty = /^\s*\}/.test(rest)
  return text.slice(0, open + 1) + `\n${indent}"compilerOptions": {\n${body(indent + indent)}\n${indent}}${empty ? "\n" : ","}` + rest
}

/** The package manager a repository uses, from its lockfile. */
export function packageManager(files) {
  if (files.includes("pnpm-lock.yaml")) return "pnpm"
  if (files.includes("bun.lock") || files.includes("bun.lockb")) return "bun"
  if (files.includes("yarn.lock")) return "yarn"
  return "npm"
}

/** The command that installs after the edits, letting the lockfile change. */
export const installCommand = (manager) => ({
  pnpm: "pnpm install --no-frozen-lockfile",
  bun: "bun install",
  yarn: "yarn install",
  npm: "npm install"
})[manager]

/** Where a staged toolchain's tarballs live in the target: at its root, ignored, so no commit names the machine's own paths. */
export const toolchainDirectory = ".vibelang-toolchain"

/**
 * The dependency specifiers of a package at packageDir (relative to the
 * repository root) for tarballs in the root's toolchain directory:
 * file:../../.vibelang-toolchain/vibelang-0.0.11.tgz from packages/x.
 */
export function toolchainSpecs(packageDir, tarballs) {
  const up = packageDir === "." || packageDir === "" ? "./" : "../".repeat(packageDir.split("/").filter(Boolean).length)
  return Object.fromEntries(Object.entries(tarballs).map(([name, file]) => [name, `file:${up}${toolchainDirectory}/${file}`]))
}

/** A .gitignore's text with line present (add) or absent (remove); other lines are kept. */
export function setIgnoreLine(text, line, present) {
  const lines = text.split("\n")
  const has = lines.some((l) => l.trim() === line)
  if (present) return has ? text : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`
  return has ? lines.filter((l) => l.trim() !== line).join("\n") : text
}
