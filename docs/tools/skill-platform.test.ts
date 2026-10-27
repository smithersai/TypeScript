import { expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { defaultCompiler, linkModules } from "./check-snippets"

const repo = resolve(import.meta.dir, "../..")
const compiler = defaultCompiler()
const skill = "packages/compiler/skills/vibelang/SKILL.md"

// A main that needs each experimental service (D313).
const uses: Record<string, string> = {
  FileSystem: `Experimental.FileSystem.access("tool", { executable: true })`,
  Crypto: `Experimental.Crypto.hmac("SHA-256", Redacted.make(new Uint8Array([1])), new Uint8Array([2]))`,
  Process: `Experimental.Process.pid()`,
  Locks: `using held = Experimental.Locks.hold("a")`,
}

// The experimental modules a clause of the skill names: `Experimental.Process`, `.FileSystem`.
const modules = (clause: string) => [...clause.matchAll(/`(?:Experimental)?\.(\w+)`/g)].map(m => m[1]).sort()

// Rule 2 of the shipped skill says which experimental services the node and
// bun platform imports provide to main, and which layer the others need. The
// compiler decides: a main that needs the service compiles without EK3205
// exactly when the entry provides it.
test.skipIf(!existsSync(compiler))("skill: rule 2 names the experimental services the node and bun entries provide", () => {
  const temp = mkdtempSync(join(tmpdir(), "skill-platform-"))
  try {
    linkModules(temp)
    writeFileSync(join(temp, "package.json"), '{"type":"module"}')
    writeFileSync(join(temp, "tsconfig.json"), JSON.stringify({
      compilerOptions: { target: "es2022", lib: ["esnext", "dom"], module: "nodenext", moduleResolution: "nodenext", strict: true, types: [], skipLibCheck: true, noEmit: true },
      include: ["*.vibe"],
      vibelang: { diagnostics: { EK3205: "error" } }
    }))
    for (const platform of ["node", "bun"])
      for (const [name, use] of Object.entries(uses))
        writeFileSync(join(temp, `${platform}-${name}.vibe`), `import "vibelang/platform/${platform}"\n\nexport function main() {\n  ${use}\n}\n`)
    const result = Bun.spawnSync([compiler, "-p", "tsconfig.json", "--pretty", "false"], { cwd: temp, stdout: "pipe", stderr: "pipe" })
    const output = result.stdout.toString() + result.stderr.toString()
    const errors = output.split("\n").filter(line => / error /.test(line))
    expect(errors.filter(line => !/ error EK3205: /.test(line))).toEqual([])
    const unprovided = (platform: string) => Object.keys(uses).filter(name => errors.some(line => line.startsWith(`${platform}-${name}.vibe(`))).sort()
    const provided = (platform: string) => Object.keys(uses).filter(name => !unprovided(platform).includes(name)).sort()
    expect(provided("bun")).toEqual(provided("node"))
    expect(unprovided("bun")).toEqual(unprovided("node"))

    const text = readFileSync(join(repo, skill), "utf8")
    const entries = /For what Effect lacks, use ([^\n]*?), which the node and bun entries provide too, and ([^\n]*?), which no node or bun entry provides: ([^\n]*?);/.exec(text)
    expect(entries).not.toBeNull()
    const [, said, unsaid, layers] = entries!
    expect(modules(said)).toEqual(provided("node"))
    expect(modules(unsaid)).toEqual(unprovided("node"))
    for (const name of unprovided("node")) expect(layers).toContain(`ExperimentalNode${name}.layer`)
  } finally {
    rmSync(temp, { recursive: true, force: true })
  }
}, 60_000)
