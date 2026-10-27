// Compile a consumer of the experimental services against the package exports and emitted .d.ts files.
import * as EffectBrowserCrypto from "@effect/platform-browser/BrowserCrypto"
import * as EffectNodeServices from "@effect/platform-node/NodeServices"
import * as Effect from "effect/Effect"
import type * as Layer from "effect/Layer"
import type * as Option from "effect/Option"
import type { PlatformError } from "effect/PlatformError"
import type * as Scope from "effect/Scope"
import { Locks, Process } from "vibelang-runtime/experimental"
import { Locks as LocksModule } from "vibelang-runtime/experimental/Locks"
import { BrowserLocks, BrowserServices } from "vibelang-runtime/experimental/platform-browser"
import { BunProcess, BunServices } from "vibelang-runtime/experimental/platform-bun"
import { NodeLocks, NodeProcess, NodeServices } from "vibelang-runtime/experimental/platform-node"
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

const locks = Effect.service(Locks.Locks)
const held: Effect.Effect<Locks.Held, PlatformError, Locks.Locks | Scope.Scope> = Effect.flatMap(locks, (locks) => locks.hold("a", { steal: true }))
const tried: Effect.Effect<Option.Option<Locks.Held>, PlatformError, Locks.Locks | Scope.Scope> = Effect.flatMap(locks, (locks) => locks.tryHold("a"))
const snapshot: Effect.Effect<Locks.LockSnapshot, PlatformError, Locks.Locks> = Effect.flatMap(locks, (locks) => locks.query)
const lost: Effect.Effect<void, PlatformError, Locks.Locks | Scope.Scope> = Effect.flatMap(held, (held) => held.lost)
const lockLayers: ReadonlyArray<Layer.Layer<Locks.Locks>> = [BrowserLocks.layer, NodeLocks.layer, BrowserServices.layer, Locks.layerTest()]
const overLockManager: Locks.Locks = Locks.make(navigator.locks)
const sameLocksKey: typeof Locks.Locks = LocksModule
void [pid, platform, memory, killed, running, failing, processLayers, sameKey, held, tried, snapshot, lost, lockLayers, overLockManager, sameLocksKey]

// Process and Locks have identities of their own: no layer of Effect's
// provides them, so their requirements stay.
type Requirements<T> = T extends Effect.Effect<infer _A, infer _E, infer R> ? R : never
type Same<A, B> = [A] extends [B] ? [B] extends [A] ? true : false : false
const both = Effect.andThen(pid, held)
const leftByNode = Effect.provide(both, EffectNodeServices.layer)
const leftByBrowser = Effect.provide(both, EffectBrowserCrypto.layer)
const leftNode: Same<Requirements<typeof leftByNode>, Process.Process | Locks.Locks | Scope.Scope> = true
const leftBrowser: Same<Requirements<typeof leftByBrowser>, Process.Process | Locks.Locks | Scope.Scope> = true
void [leftNode, leftBrowser]
