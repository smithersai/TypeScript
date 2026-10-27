// The Process service over the host's `process` object and `node:os`: Node.js
// implements both, and Bun implements them as Node.js does.
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as PlatformError from "effect/PlatformError"
import type { ProcessId } from "effect/process/ChildProcessSpawner"
import * as Process from "../Process.js"

// The part of the host's process object this layer reads. The runtime declares
// it here rather than depending on @types/node, as its entry does.
interface Host {
  readonly pid: number
  readonly platform: string
  readonly arch: string
  readonly execPath: string
  readonly versions: Readonly<Record<string, string | undefined>>
  readonly memoryUsage: () => Process.MemoryUsage
  readonly kill: (pid: number, signal: string | number) => true
  readonly getBuiltinModule: (id: "node:os") => unknown
}

interface Os {
  readonly hostname: () => string
  readonly availableParallelism: () => number
}

const systemErrors: Readonly<Record<string, PlatformError.SystemErrorTag>> = {
  ESRCH: "NotFound",
  EPERM: "PermissionDenied"
}

// A failed signal's PlatformError: no such process, not permitted, an unknown
// signal (Node.js throws ERR_UNKNOWN_SIGNAL, the system EINVAL), or Unknown.
const failure = (method: "kill" | "isRunning", pid: number, error: unknown): PlatformError.PlatformError => {
  const code = typeof error === "object" && error !== null ? (error as { readonly code?: unknown }).code : undefined
  const message = error instanceof Error ? error.message : String(error)
  if (code === "ERR_UNKNOWN_SIGNAL" || code === "EINVAL") {
    return PlatformError.badArgument({ module: "Process", method, description: message, cause: error })
  }
  return PlatformError.systemError({
    _tag: (typeof code === "string" ? systemErrors[code] : undefined) ?? "Unknown",
    module: "Process",
    method,
    syscall: "kill",
    pathOrDescriptor: pid,
    description: message,
    cause: error
  })
}

// The id process.kill takes: the process, or its group's negated id. A pid
// that is not a positive integer is refused, since 0 and negative ids name
// this process's own group or every process the user may signal.
const target = (
  host: Host,
  method: "kill" | "isRunning",
  pid: number,
  group: boolean | undefined
): Effect.Effect<number, PlatformError.PlatformError> => {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    return Effect.fail(PlatformError.badArgument({
      module: "Process",
      method,
      description: `pid must be a positive integer, got ${pid}; signal a process group with { group: true }`
    }))
  }
  if (group === true && host.platform === "win32") {
    return Effect.fail(PlatformError.badArgument({
      module: "Process",
      method,
      description: "process groups are POSIX only; Windows has none"
    }))
  }
  return Effect.succeed(group === true ? -pid : pid)
}

const make = (): Process.Process => {
  const host = (globalThis as { readonly process?: Host }).process
  if (host === undefined || typeof host.getBuiltinModule !== "function") {
    throw new Error("The Process layer needs Node.js or Bun: this host has no process object")
  }
  const os = host.getBuiltinModule("node:os") as Os
  return Process.make({
    pid: Effect.sync(() => host.pid as ProcessId),
    platform: Effect.sync(() => host.platform as Process.Platform),
    arch: Effect.sync(() => host.arch),
    execPath: Effect.sync(() => host.execPath),
    versions: Effect.sync(() => {
      const versions: Record<string, string> = {}
      for (const [name, version] of Object.entries(host.versions)) {
        if (typeof version === "string") versions[name] = version
      }
      return versions
    }),
    hostname: Effect.sync(() => os.hostname()),
    availableParallelism: Effect.sync(() => os.availableParallelism()),
    timeOrigin: Effect.sync(() => globalThis.performance.timeOrigin),
    memoryUsage: Effect.sync(() => {
      const { rss, heapTotal, heapUsed, external, arrayBuffers } = host.memoryUsage()
      return { rss, heapTotal, heapUsed, external, arrayBuffers }
    }),
    kill: (pid, options) =>
      Effect.flatMap(target(host, "kill", pid, options?.group), (id) =>
        Effect.try({
          try: () => {
            host.kill(id, options?.killSignal ?? "SIGTERM")
          },
          catch: (error) => failure("kill", pid, error)
        })),
    isRunning: (pid, options) =>
      Effect.flatMap(target(host, "isRunning", pid, options?.group), (id) =>
        Effect.suspend(() => {
          try {
            host.kill(id, 0)
            return Effect.succeed(true)
          } catch (error) {
            const code = typeof error === "object" && error !== null
              ? (error as { readonly code?: unknown }).code
              : undefined
            // EPERM: the process exists, and belongs to someone else.
            if (code === "EPERM") return Effect.succeed(true)
            if (code === "ESRCH") return Effect.succeed(false)
            return Effect.fail(failure("isRunning", pid, error))
          }
        }))
  })
}

/** Provides `Process` over the host's `process` object and `node:os`. */
export const layer: Layer.Layer<Process.Process> = Layer.sync(Process.Process, make)
