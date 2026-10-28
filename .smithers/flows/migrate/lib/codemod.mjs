// The codemod: rename a batch's modules to .vibe, rewrite the imports that
// name them by VibeLang's rules, then run `vibelang --fix` until it finds
// nothing more to fix, recording each rewrite it applied and each it refused.
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join, posix } from "node:path"
import { applyEdits, parseImports, resolveRelative } from "./imports.mjs"
import { parseDiagnostics } from "./diagnostics.mjs"
import { quote, run } from "./util.mjs"

/** x.ts becomes x.vibe. Only .ts modules are renamed. */
export function vibePath(path) {
  if (!path.endsWith(".ts") || path.endsWith(".d.ts")) throw new Error(`${path}: only a .ts module becomes .vibe`)
  return path.slice(0, -3) + ".vibe"
}

/** Renames each file of the batch on disk; refuses to overwrite. */
export function renameBatch(root, files) {
  const renames = files.map((from) => ({ from, to: vibePath(from) }))
  for (const { from, to } of renames) {
    if (!existsSync(join(root, from))) throw new Error(`${from} does not exist`)
    if (existsSync(join(root, to))) throw new Error(`${to} already exists`)
  }
  for (const { from, to } of renames) renameSync(join(root, from), join(root, to))
  return renames
}

/**
 * The specifier that names target from a file, by VibeLang's rules: a .vibe
 * file imports a local module by its source name (./user.vibe, ./util.ts); a
 * .ts file may keep a .js specifier, which resolves to the .vibe source, and
 * a .ts specifier of a renamed module becomes .vibe.
 */
export function rewriteSpecifier(importer, specifier, target) {
  const targetExt = posix.extname(target)
  const ext = posix.extname(specifier)
  const vibeImporter = importer.endsWith(".vibe")
  if (vibeImporter) {
    if (ext === targetExt) return specifier
    if ([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".vibe"].includes(ext)) return specifier.slice(0, -ext.length) + targetExt
    // Extensionless: name the file, or the directory's index file.
    const base = posix.normalize(posix.join(posix.dirname(importer), specifier))
    if (target === `${base}/index${targetExt}`) return `${specifier.replace(/\/$/, "")}/index${targetExt}`
    return specifier + targetExt
  }
  if (targetExt === ".vibe" && [".ts", ".mts"].includes(ext)) return specifier.slice(0, -ext.length) + ".vibe"
  return specifier
}

/**
 * Rewrites the relative imports of every file in scope (repository-relative
 * paths after the renames) so each names its target as VibeLang reads it.
 * Returns the edits made: { file, from, to }.
 */
export function rewriteImports(root, scope) {
  const files = new Set(scope)
  const edits = []
  for (const file of scope) {
    if (!/\.(?:ts|tsx|mts|cts|vibe)$/.test(file)) continue
    const path = join(root, file)
    const text = readFileSync(path, "utf8")
    const changes = []
    for (const i of parseImports(text)) {
      const target = resolveRelative(file, i.specifier, files)
      if (!target) continue
      const next = rewriteSpecifier(file, i.specifier, target)
      if (next !== i.specifier) {
        changes.push({ start: i.start, end: i.end, text: next })
        edits.push({ file, from: i.specifier, to: next })
      }
    }
    if (changes.length) writeFileSync(path, applyEdits(text, changes))
  }
  return edits
}

const fixLine = /^vibelang --fix: (.+?): (\d+) (?:fix|fixes) \((.*)\)$/
const refusalLine = /^vibelang --fix: (.+?):(\d+): (EK\d+) not fixed: the fixed program would report (.*)$/

/** Reads one `vibelang --fix` run: the rewrites applied per file, by kind, and the refusals. */
export function parseFixOutput(output, { cwd, root } = {}) {
  const relative = (file) => (cwd && root ? posix.relative(root, posix.join(cwd, file)) : file)
  const files = {}
  const refused = []
  let total = 0
  for (const line of output.split("\n")) {
    const fixed = fixLine.exec(line)
    if (fixed) {
      const kinds = {}
      for (const part of fixed[3].split(", ")) {
        const m = /^(.+) ×(\d+)$/.exec(part)
        if (m) kinds[m[1]] = Number(m[2])
      }
      files[relative(fixed[1])] = kinds
      total += Number(fixed[2])
      continue
    }
    const refusal = refusalLine.exec(line)
    if (refusal) refused.push({ file: relative(refusal[1]), line: Number(refusal[2]), code: refusal[3], error: refusal[4] })
  }
  return { total, files, refused }
}

/** Adds one fix run's per-kind counts into a running total, by file. */
export function mergeFixes(into, files) {
  for (const [file, kinds] of Object.entries(files)) {
    into[file] ??= {}
    for (const [kind, n] of Object.entries(kinds)) into[file][kind] = (into[file][kind] ?? 0) + n
  }
  return into
}

/**
 * Runs `vibelang -p tsconfig --fix --noEmit` until a run fixes nothing, at
 * most maxRounds times. Returns every round's report, the merged rewrites by
 * file and kind, the refusals, and the diagnostics of the last run.
 */
export async function fixToFixedPoint({ compiler, tsconfig, cwd, root, maxRounds = 4, log }) {
  const rounds = []
  const byFile = {}
  const refused = []
  let last
  for (let round = 1; round <= maxRounds; round++) {
    const result = await run(`${quote(compiler)} -p ${quote(tsconfig)} --fix --noEmit --pretty false`, { cwd, log: log && `${log}.${round}.log` })
    const parsed = parseFixOutput(result.stdout, { cwd, root })
    rounds.push({ round, code: result.code, fixes: parsed.total, files: parsed.files, refused: parsed.refused })
    mergeFixes(byFile, parsed.files)
    refused.push(...parsed.refused)
    last = result
    if (parsed.total === 0) break
  }
  const settled = rounds.at(-1).fixes === 0
  return { settled, rounds, byFile, refused, diagnostics: parseDiagnostics(last.stdout + last.stderr, { cwd, root }) }
}

/** Totals of the rewrites that fired, by kind, over every file. */
export function rewriteTotals(byFile) {
  const totals = {}
  for (const kinds of Object.values(byFile)) for (const [kind, n] of Object.entries(kinds)) totals[kind] = (totals[kind] ?? 0) + n
  return totals
}
