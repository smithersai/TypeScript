// Compile a consumer of the experimental services against the package exports and emitted .d.ts files.
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import type { PlatformError } from "effect/PlatformError"
import { Process } from "vibelang-runtime/experimental"
import { BunProcess, BunServices } from "vibelang-runtime/experimental/platform-bun"
import { NodeProcess, NodeServices } from "vibelang-runtime/experimental/platform-node"
import { Process as ProcessModule } from "vibelang-runtime/experimental/Process"

const host = Effect.service(Process.Process)
const pid: Effect.Effect<number, never, Process.Process> = Effect.flatMap(host, (process) => process.pid)
const platform: Effect.Effect<"darwin" | "linux" | "win32" | Process.Platform, never, Process.Process> = Effect.flatMap(host, (process) => process.platform)
const memory: Effect.Effect<Process.MemoryUsage, never, Process.Process> = Effect.flatMap(host, (process) => process.memoryUsage)
const killed: Effect.Effect<void, PlatformError, Process.Process> = Effect.flatMap(host, (process) => process.kill(42, { killSignal: "SIGKILL", group: true }))
const running: Effect.Effect<boolean, PlatformError, Process.Process> = Effect.flatMap(host, (process) => process.isRunning(42, { group: false }))
// @ts-expect-error Signals are Effect's ChildProcess.Signal names.
Effect.flatMap(host, (process) => process.kill(42, { killSignal: "SIGNOPE" }))
// @ts-expect-error kill can fail, and succeeds with nothing.
const failing: Effect.Effect<string, never, Process.Process> = Effect.flatMap(host, (process) => process.kill(1))
const processLayers: ReadonlyArray<Layer.Layer<Process.Process>> = [
  NodeProcess.layer, BunProcess.layer, NodeServices.layer, BunServices.layer, Process.layerTest({ pid: Effect.succeed(7 as never) })
]
const sameKey: typeof Process.Process = ProcessModule

void [pid, platform, memory, killed, running, failing, processLayers, sameKey]
