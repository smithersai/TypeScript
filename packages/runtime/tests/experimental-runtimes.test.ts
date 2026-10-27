import { expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const packageDir = fileURLToPath(new URL("..", import.meta.url))

// One program per host, through the package's own exports: each host runs its
// layer bundle on the real file system and WebCrypto.
const program = (platform: "node" | "bun", dir: string) => `
import { spawnSync } from "node:child_process"
import { chmodSync, renameSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { Effect, Redacted } from "effect"
import { Crypto, FileSystem, Process } from "vibelang-runtime/experimental"
import { ${platform === "node" ? "ExperimentalNodeServices" : "ExperimentalBunServices"} as Services } from "vibelang-runtime/experimental/platform-${platform}"
const dir = ${JSON.stringify(dir)}
writeFileSync(join(dir, "target"), "")
symlinkSync("target", join(dir, "link"))
writeFileSync(join(dir, "data"), "")
chmodSync(join(dir, "data"), 0o644)
spawnSync("mkfifo", [join(dir, "fifo")])
const hex = (bytes) => Buffer.from(bytes).toString("hex")
const program = Effect.gen(function*() {
  const fs = yield* FileSystem.FileSystem
  const crypto = yield* Crypto.Crypto
  const link = (yield* fs.lstat(join(dir, "link"))).type
  const denied = (yield* Effect.flip(fs.access(join(dir, "data"), { executable: true }))).reason._tag
  const fifo = yield* Effect.scoped(Effect.flatMap(fs.open(join(dir, "fifo"), { nonBlocking: true }), (file) => file.stat))
  yield* Effect.scoped(Effect.gen(function*() {
    const file = yield* fs.open(join(dir, "data"), { flag: "r+" })
    renameSync(join(dir, "data"), join(dir, "moved"))
    yield* file.chmod(0o600)
  }))
  const mac = hex(yield* crypto.hmac("SHA-256", Redacted.make(new TextEncoder().encode("Jefe")), new TextEncoder().encode("what do ya want for nothing?")))
  const seed = Buffer.from("302e020100300506032b657004220420" + "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60", "hex")
  const signature = hex(yield* crypto.sign("Ed25519", Redacted.make(new Uint8Array(seed)), new Uint8Array()))
  const pid = (yield* (yield* Process.Process).pid) === process.pid
  return { link, denied, fifo: fifo.type, mode: (statSync(join(dir, "moved")).mode & 0o777).toString(8), mac, signature, pid }
})
console.log(JSON.stringify(await Effect.runPromise(Effect.provide(program, Services.layer))))
`

for (const [platform, command] of [["node", "node"], ["bun", process.execPath]] as const) {
  test(`${platform === "node" ? "Node" : "Bun"} runs the experimental services from its platform bundle`, () => {
    const dir = mkdtempSync(join(tmpdir(), "vibelang-experimental-host-"))
    try {
      const script = join(packageDir, "tests", `.experimental-${platform}-${process.pid}.mjs`)
      writeFileSync(script, program(platform, dir))
      try {
        const result = Bun.spawnSync([command, script], { cwd: packageDir, stdout: "pipe", stderr: "pipe" })
        expect(result.stderr.toString()).toBe("")
        expect(JSON.parse(result.stdout.toString())).toEqual({
          link: "SymbolicLink",
          denied: "PermissionDenied",
          fifo: "FIFO",
          mode: "600",
          mac: "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
          signature: "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
          pid: true
        })
        expect(result.exitCode).toBe(0)
      } finally {
        rmSync(script, { force: true })
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)
}

test("a browser bundle of the Experimental namespace has no Node module and runs WebCrypto; one that does not use it carries none of it", async () => {
  const dir = mkdtempSync(join(packageDir, "tests", ".experimental-bundle-"))
  try {
    writeFileSync(join(dir, "browser.js"), `
      import { Effect, Redacted } from "effect"
      import { Crypto } from "vibelang-runtime/experimental"
      import { ExperimentalBrowserCrypto } from "vibelang-runtime/experimental/platform-browser"
      const mac = Effect.flatMap(Effect.service(Crypto.Crypto), (crypto) =>
        crypto.hmac("SHA-256", Redacted.make(new TextEncoder().encode("Jefe")), new TextEncoder().encode("what do ya want for nothing?")))
      console.log(Array.from(await Effect.runPromise(Effect.provide(mac, ExperimentalBrowserCrypto.layer)), (b) => b.toString(16).padStart(2, "0")).join(""))
    `)
    writeFileSync(join(dir, "root.js"), `import { Effect, $bind } from "vibelang-runtime"; console.log(Effect.runSync($bind(42)))`)
    const bundle = async (entry: string) => {
      const bundled = await Bun.build({
        entrypoints: [join(dir, entry)], target: "browser", format: "esm", outdir: join(dir, "bundle"), minify: true
      })
      expect(bundled.success).toBe(true)
      return bundled.outputs[0].text()
    }
    const [browser, root] = [await bundle("browser.js"), await bundle("root.js")]
    expect(browser).not.toContain("node:fs")
    expect(browser).not.toContain("@effect/platform-node")
    expect(browser).toContain("vibelang/experimental/Crypto")
    expect(root).not.toContain("vibelang/experimental")
    const result = Bun.spawnSync(["node", join(dir, "bundle", "browser.js")], { stdout: "pipe", stderr: "pipe" })
    expect(result.stderr.toString()).toBe("")
    expect(result.stdout.toString().trim()).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}, 30_000)
