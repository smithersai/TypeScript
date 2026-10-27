// Observes the experimental Process service against real processes: this one, and
// children spawned with Effect's ChildProcessSpawner. Run in-process under Bun by
// experimental-process.test.ts, and under Node.js by process-node.ts.
import * as Effect from "effect/Effect"
import * as PlatformError from "effect/PlatformError"
import * as ChildProcess from "effect/process/ChildProcess"
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner"
import * as Stream from "effect/Stream"
import { Process } from "vibelang-runtime/experimental"

const reason = (error: PlatformError.PlatformError) => ({
  _tag: error.reason._tag,
  module: error.reason.module,
  method: error.reason.method
})

// The failure of an Effect expected to fail, as its reason.
const failure = <A>(effect: Effect.Effect<A, PlatformError.PlatformError>) => Effect.map(Effect.flip(effect), reason)

// Waits until `isRunning` answers false: the spawner reaps a child once it exits.
const gone = (pid: number, options?: Process.IsRunningOptions) =>
  Effect.gen(function*() {
    const process = yield* Process.Process
    while (yield* process.isRunning(pid, options)) yield* Effect.sleep("10 millis")
  }).pipe(Effect.timeout("10 seconds"))

// Spawns `sh -c script` and waits for its first line, so a trap the script sets is installed.
const spawnReady = (script: string) =>
  Effect.gen(function*() {
    const spawner = yield* ChildProcessSpawner
    const handle = yield* spawner.spawn(ChildProcess.make("sh", ["-c", script]))
    yield* handle.stdout.pipe(Stream.decodeText, Stream.splitLines, Stream.runHead)
    return handle
  })

export const observe = Effect.gen(function*() {
  const process = yield* Process.Process
  const host = globalThis.process
  const os = host.getBuiltinModule("node:os")
  const facts = {
    pid: (yield* process.pid) === host.pid,
    platform: (yield* process.platform) === host.platform,
    arch: (yield* process.arch) === host.arch,
    execPath: (yield* process.execPath) === host.execPath,
    versions: JSON.stringify(yield* process.versions) === JSON.stringify(host.versions),
    hostname: (yield* process.hostname) === os.hostname(),
    availableParallelism: (yield* process.availableParallelism) === os.availableParallelism(),
    timeOrigin: (yield* process.timeOrigin) === performance.timeOrigin,
    memoryUsage: Object.entries(yield* process.memoryUsage).map(([key, value]) => `${key}:${typeof value}`).join(" ")
  }

  // A child runs until killed; once reaped, it is gone, and a second kill finds nothing.
  const killed = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* spawnReady("echo ready; exec sleep 30")
    const before = yield* process.isRunning(child.pid)
    yield* process.kill(child.pid)
    yield* gone(child.pid)
    return {
      before,
      after: yield* process.isRunning(child.pid),
      exit: yield* failure(child.exitCode),
      again: yield* failure(process.kill(child.pid))
    }
  }))

  // killSignal chooses the signal: the child's trap for SIGUSR1 sets its exit code.
  const signalled = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* spawnReady("trap 'exit 7' USR1; echo ready; while :; do sleep 0.05; done")
    yield* process.kill(child.pid, { killSignal: "SIGUSR1" })
    return Number(yield* child.exitCode)
  }))

  // The spawner starts a child in a process group of its own. Killing the
  // leader leaves its background job running in the group; group kills both.
  const group = yield* Effect.scoped(Effect.gen(function*() {
    const child = yield* spawnReady("sleep 30 & echo ready; wait")
    yield* process.kill(child.pid, { killSignal: "SIGKILL" })
    yield* gone(child.pid)
    const leaderGone = !(yield* process.isRunning(child.pid))
    const groupAfterLeader = yield* process.isRunning(child.pid, { group: true })
    yield* process.kill(child.pid, { group: true, killSignal: "SIGKILL" })
    yield* gone(child.pid, { group: true })
    return {
      leaderGone,
      groupAfterLeader,
      groupAfterGroupKill: yield* process.isRunning(child.pid, { group: true }),
      again: yield* failure(process.kill(child.pid, { group: true }))
    }
  }))

  const failures = {
    zero: yield* failure(process.kill(0)),
    negative: yield* failure(process.kill(-1)),
    fraction: yield* failure(process.isRunning(1.5)),
    nan: yield* failure(process.isRunning(Number.NaN)),
    // SIGBREAK exists only on Windows.
    unknownSignal: yield* failure(process.kill(host.pid, { killSignal: "SIGBREAK" })),
    // pid 1 belongs to root: it runs, and an unprivileged user may not signal it.
    initRunning: yield* process.isRunning(1),
    initKill: host.getuid?.() === 0 ? "root" : yield* failure(process.kill(1, { killSignal: "SIGCONT" }))
  }

  return { facts, killed, signalled, group, failures }
})
