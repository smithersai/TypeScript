import { readFileSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"

const repo = resolve(import.meta.dir, "../..")

function files(root: string, extension: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    const path = join(root, entry.name)
    return entry.isDirectory() ? files(path, extension) : path.endsWith(extension) ? [path] : []
  })
}

// Message declarations are registered across several files, not just diagnostics.go.
export function diagnosticCodes(sources: string[]): string[] {
  return [...new Set(sources.flatMap(source =>
    [...source.matchAll(/^\s*(?:var\s+)?(EK\d+)\s*=\s*message\(/gm)].map(match => match[1])))].sort()
}

export function undocumentedCodes(codes: string[], pages: string[]): string[] {
  const documented = new Set(pages.flatMap(page => [...page.matchAll(/\bEK\d+\b/g)].map(match => match[0])))
  // EK4407's module-name resolution is being reworked; document it when settled.
  return codes.filter(code => code !== "EK4407" && !documented.has(code))
}

export function checkDiagnosticDocs(root = repo): string[] {
  const sources = files(join(root, "typescript/tsc/internal/vibelang"), ".go")
    .filter(path => !path.endsWith("_test.go")).map(path => readFileSync(path, "utf8"))
  const pages = files(join(root, "docs/user/src"), ".md").map(path => readFileSync(path, "utf8"))
  return undocumentedCodes(diagnosticCodes(sources), pages)
}

if (import.meta.main) {
  const missing = checkDiagnosticDocs()
  if (missing.length) {
    console.error("User docs have no diagnostic reference for: " + missing.join(", "))
    process.exitCode = 1
  } else console.log("Every registered diagnostic is documented (EK4407 deferred).")
}
