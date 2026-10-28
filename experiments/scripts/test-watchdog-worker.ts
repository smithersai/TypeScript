// Runs beside bun test's main thread, which a spinning test blocks, and reports the stalled test.
import { readFileSync, writeSync } from "node:fs"

const STARTED = 0, FINISHED = 1, ORDINAL = 2, PATH_LENGTH = 3

type Shared = { state: Int32Array; startedAt: Float64Array; path: Uint8Array; seconds: number }

self.onmessage = ({ data }: MessageEvent<Shared>) => {
  const { state, startedAt, path, seconds } = data
  setInterval(() => {
    if (Atomics.load(state, STARTED) === Atomics.load(state, FINISHED)) return
    const elapsed = (Date.now() - startedAt[0]!) / 1000
    if (elapsed < seconds) return
    const file = new TextDecoder().decode(path.slice(0, Atomics.load(state, PATH_LENGTH)))
    const ordinal = Atomics.load(state, ORDINAL)
    const name = testName(file, ordinal)
    writeSync(2, `\nkernel test watchdog: test ${ordinal} in the file ${file}${name === undefined ? "" : ` (probably "${name}")`} has run for ${Math.round(elapsed)} s, past KERNEL_TEST_STALL_SECONDS=${seconds}. bun's per-test timeout cannot stop synchronous code, so the watchdog ends the run.\n`)
    process.kill(process.pid, "SIGKILL")
  }, 1000)
}

// The n-th test the file declares, skipping skipped and todo tests; a guess when tests are generated.
function testName(file: string, ordinal: number): string | undefined {
  try {
    const source = readFileSync(file, "utf8")
    const names = [...source.matchAll(/\b(?:test|it)(?!\.(?:skip|todo)\b)(?:\.\w+)?\(\s*(["'`])((?:(?!\1).)*)\1/g)].map(match => match[2]!)
    return names[ordinal - 1]
  } catch {
    return undefined
  }
}
