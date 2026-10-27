import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"

const packageDir = fileURLToPath(new URL("..", import.meta.url))

// The experimental Crypto and FileSystem keys differ from Effect's at run
// time, so their requirement types must differ too (D313): stock TypeScript
// rejects a program that claims Effect's bundle provided the experimental
// Crypto, and accepts the experimental bundle.
test("experimental identity: Effect's bundle leaves the experimental Crypto unprovided under stock tsc", () => {
  const result = Bun.spawnSync(["bun", "x", "--no-install", "tsc", "-p", "tests/experimental-identity/tsconfig.json"], {
    cwd: packageDir, stdout: "pipe", stderr: "pipe"
  })
  const output = result.stdout.toString() + result.stderr.toString()
  expect(output.split("\n").filter((line) => line.includes(": error "))).toEqual([
    "tests/experimental-identity/standard-provider.ts(17,14): error TS2322: Type 'Effect<Uint8Array<ArrayBufferLike>, PlatformError, Crypto>' is not assignable to type 'Effect<Uint8Array<ArrayBufferLike>, PlatformError, never>'."
  ])
  expect(result.exitCode).toBe(2)
}, 30_000)
