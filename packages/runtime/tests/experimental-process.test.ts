import { BunServices } from "@effect/platform-bun"
import { expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/PlatformError"
import { Process } from "vibelang-runtime/experimental"
import { BunProcess, BunServices as ExperimentalBunServices } from "vibelang-runtime/experimental/platform-bun"
import { NodeProcess, NodeServices as ExperimentalNodeServices } from "vibelang-runtime/experimental/platform-node"
import { observe } from "./fixtures/process-scenarios.ts"

const facts = {
  pid: true,
  platform: true,
  arch: true,
  execPath: true,
  versions: true,
  hostname: true,
  availableParallelism: true,
  timeOrigin: true,
  memoryUsage: "rss:number heapTotal:number heapUsed:number external:number arrayBuffers:number"
}

const rejected = (method: string, _tag = "BadArgument") => ({ _tag, module: "Process", method })

// What every host must observe; process-scenarios.ts says how each is produced.
const expectObserved = (observed: any) => {
  expect(observed.facts).toEqual(facts)
  expect(observed.killed).toMatchObject({ before: true, after: false, again: rejected("kill", "NotFound") })
  // Effect's exitCode fails when a signal ends the child; ChildProcessHandle has no exit signal yet.
  expect(observed.killed.exit.module).toBe("ChildProcess")
  expect(observed.signalled).toBe(7)
  expect(observed.group).toEqual({
    leaderGone: true,
    groupAfterLeader: true,
    groupAfterGroupKill: false,
    again: rejected("kill", "NotFound")
  })
  expect(observed.failures).toEqual({
    zero: rejected("kill"),
    negative: rejected("kill"),
    fraction: rejected("isRunning"),
    nan: rejected("isRunning"),
    unknownSignal: rejected("kill"),
    initRunning: true,
    initKill: process.getuid?.() === 0 ? "root" : rejected("kill", "PermissionDenied")
  })
}

test("Process: Bun's layer reads this process and signals real children", async () => {
  expectObserved(await Effect.runPromise(observe.pipe(Effect.provide(Layer.merge(BunServices.layer, BunProcess.layer)))))
}, 30_000)

test("Process: Node.js's layer reads this process and signals real children", () => {
  const result = Bun.spawnSync(["node", "tests/fixtures/process-node.ts"], {
    cwd: new URL("..", import.meta.url).pathname, stdout: "pipe", stderr: "pipe"
  })
  expect(result.stderr.toString()).toBe("")
  expect(result.exitCode).toBe(0)
  expectObserved(JSON.parse(result.stdout.toString()))
}, 30_000)

test("Process: the platform bundles provide the Node.js and Bun layers", async () => {
  const pid = Effect.flatMap(Effect.service(Process.Process), (process) => process.pid)
  expect(await Effect.runPromise(Effect.provide(pid, ExperimentalNodeServices.layer))).toBe(process.pid)
  expect(await Effect.runPromise(Effect.provide(pid, ExperimentalBunServices.layer))).toBe(process.pid)
  expect(NodeProcess.layer).toBe(BunProcess.layer)
})

test("Process: the layer is a defect without a host process object", async () => {
  const saved = globalThis.process
  const exit = await (async () => {
    Object.defineProperty(globalThis, "process", { value: undefined, configurable: true, writable: true })
    try {
      return await Effect.runPromiseExit(Effect.provide(Effect.service(Process.Process), NodeProcess.layer))
    } finally {
      Object.defineProperty(globalThis, "process", { value: saved, configurable: true, writable: true })
    }
  })()
  expect(exit._tag).toBe("Failure")
  expect(String(exit)).toContain("The Process layer needs Node.js or Bun")
})

test("Process: process groups are refused on Windows", async () => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!
  Object.defineProperty(process, "platform", { ...platform, value: "win32" })
  try {
    const observed = await Effect.runPromise(Effect.gen(function*() {
      const host = yield* Process.Process
      return {
        platform: yield* host.platform,
        kill: (yield* Effect.flip(host.kill(process.pid, { group: true }))).reason,
        isRunning: (yield* Effect.flip(host.isRunning(process.pid, { group: true }))).reason,
        alone: yield* host.isRunning(process.pid)
      }
    }).pipe(Effect.provide(NodeProcess.layer)))
    expect(observed).toMatchObject({
      platform: "win32",
      kill: { _tag: "BadArgument", module: "Process", method: "kill" },
      isRunning: { _tag: "BadArgument", module: "Process", method: "isRunning" },
      alone: true
    })
  } finally {
    Object.defineProperty(process, "platform", platform)
  }
})

test("Process: layerTest answers fixed facts and a host with no other process", async () => {
  const observed = await Effect.runPromise(Effect.gen(function*() {
    const process = yield* Process.Process
    return {
      pid: yield* process.pid,
      platform: yield* process.platform,
      arch: yield* process.arch,
      execPath: yield* process.execPath,
      versions: yield* process.versions,
      hostname: yield* process.hostname,
      availableParallelism: yield* process.availableParallelism,
      timeOrigin: yield* process.timeOrigin,
      memoryUsage: yield* process.memoryUsage,
      running: yield* process.isRunning(42),
      kill: yield* Effect.flip(process.kill(42))
    }
  }).pipe(Effect.provide(Process.layerTest())))
  expect(observed).toMatchObject({
    pid: 1,
    platform: "linux",
    arch: "x64",
    execPath: "/usr/local/bin/node",
    versions: {},
    hostname: "localhost",
    availableParallelism: 1,
    timeOrigin: 0,
    memoryUsage: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 },
    running: false
  })
  expect(PlatformError.isPlatformError(observed.kill)).toBe(true)
  expect(observed.kill.reason).toMatchObject({ _tag: "NotFound", module: "Process", method: "kill", pathOrDescriptor: 42 })
})

test("Process: layerTest takes the members a test overrides", async () => {
  const signalled: Array<unknown> = []
  const layer = Process.layerTest({
    platform: Effect.succeed("win32"),
    kill: (pid, options) => Effect.sync(() => void signalled.push([pid, options]))
  })
  const platform = await Effect.runPromise(Effect.gen(function*() {
    const process = yield* Process.Process
    yield* process.kill(7, { killSignal: "SIGINT" })
    return yield* process.platform
  }).pipe(Effect.provide(layer)))
  expect(platform).toBe("win32")
  expect(signalled).toEqual([[7, { killSignal: "SIGINT" }]])
})
