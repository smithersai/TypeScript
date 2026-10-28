import { expect, test } from "bun:test"
import { join } from "node:path"

// The kernel suite once spun at 100% CPU with no output: bun buffers a file's results, and its
// per-test timeout cannot interrupt synchronous code. The watchdog names the stalled test.
test("the watchdog names a test that spins past its deadline and ends the run", () => {
  const fixture = join(import.meta.dir, "../scripts/watchdog-fixture")
  const started = Date.now()
  const run = Bun.spawnSync(["bun", "test", "spin.test.ts"], {
    cwd: fixture,
    env: { ...process.env, KERNEL_TEST_STALL_SECONDS: "2" },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 30000
  })
  const output = run.stdout.toString() + run.stderr.toString()
  expect(run.exitCode === 0).toBe(false)
  expect(Date.now() - started).toBeLessThan(20000)
  expect(output).toContain("kernel test watchdog")
  expect(output).toContain("spin.test.ts")
  expect(output).toContain("test 2 in the file")
  expect(output).toContain('"spins forever"')
})
