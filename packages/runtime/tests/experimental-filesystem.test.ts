import { afterEach, beforeEach, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import * as EffectFileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as PlatformError from "effect/PlatformError"
import type { Scope } from "effect/Scope"
import { chmodSync, constants, mkdtempSync, readFileSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { FileSystem } from "vibelang-runtime/experimental"
import { BunFileSystem, BunServices } from "vibelang-runtime/experimental/platform-bun"
import { NodeFileSystem, NodeServices } from "vibelang-runtime/experimental/platform-node"
// The implementation behind both layers, for the platforms this host is not.
import { extend } from "../dist/experimental/internal/nodeFileSystem.js"

let dir = ""
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "vibelang-experimental-fs-"))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const run = <A, E>(layer: Layer.Layer<FileSystem.FileSystem>, program: (fs: FileSystem.FileSystem) => Effect.Effect<A, E, Scope>) =>
  Effect.runPromise(Effect.scoped(Effect.provide(Effect.flatMap(Effect.service(FileSystem.FileSystem), program), layer)))

const failure = <A>(layer: Layer.Layer<FileSystem.FileSystem>, program: (fs: FileSystem.FileSystem) => Effect.Effect<A, PlatformError.PlatformError, Scope>) =>
  run(layer, (fs) => Effect.flip(program(fs)))

const mkfifo = (path: string) => {
  const result = Bun.spawnSync(["mkfifo", path])
  expect(result.exitCode).toBe(0)
}

const layers = [
  ["NodeFileSystem", NodeFileSystem.layer],
  ["BunFileSystem", BunFileSystem.layer],
  ["NodeServices", NodeServices.layer],
  ["BunServices", BunServices.layer]
] as const

for (const [name, layer] of layers) {
  test(`${name}: Effect's own lstat reads a symbolic link itself, where stat follows it`, async () => {
    writeFileSync(join(dir, "target"), "twelve bytes")
    symlinkSync("target", join(dir, "link"))
    const [link, target, file] = await run(layer, (fs) =>
      Effect.all([fs.lstat(join(dir, "link")), fs.stat(join(dir, "link")), fs.lstat(join(dir, "target"))]))
    expect(link.type).toBe("SymbolicLink")
    expect(Number(link.size)).toBe("target".length)
    expect(target.type).toBe("File")
    expect(Number(target.size)).toBe(12)
    expect(file.type).toBe("File")
    expect(Option.getOrThrow(file.mtime)).toBeInstanceOf(Date)
    expect(file.mode & 0o777).toBe(statSync(join(dir, "target")).mode & 0o777)
  })

  test(`${name}: access with executable checks the execute bit`, async () => {
    const tool = join(dir, "tool"), data = join(dir, "data")
    writeFileSync(tool, "#!/bin/sh\n")
    writeFileSync(data, "")
    chmodSync(tool, 0o755)
    chmodSync(data, 0o644)
    await run(layer, (fs) => fs.access(tool, { executable: true }))
    await run(layer, (fs) => fs.access(tool, { executable: true, readable: true, writable: true }))
    await run(layer, (fs) => fs.access(data, { readable: true }))
    const denied = await failure(layer, (fs) => fs.access(data, { executable: true }))
    expect(denied.reason._tag).toBe("PermissionDenied")
    expect(denied.reason).toMatchObject({ method: "access", syscall: "access", pathOrDescriptor: data })
    const missing = await failure(layer, (fs) => fs.access(join(dir, "missing"), { executable: true }))
    expect(missing.reason._tag).toBe("NotFound")
    expect(await run(layer, (fs) => fs.exists(join(dir, "missing")))).toBe(false)
  })

  for (const nonBlocking of [false, true]) {
    test(`${name}: File.chmod changes the opened file after its path is renamed${nonBlocking ? " (nonBlocking)" : ""}`, async () => {
      const before = join(dir, "before"), after = join(dir, "after")
      writeFileSync(before, "secret")
      chmodSync(before, 0o644)
      await run(layer, (fs) =>
        Effect.gen(function*() {
          const file = yield* fs.open(before, { flag: "r+", nonBlocking })
          renameSync(before, after)
          writeFileSync(before, "decoy")
          chmodSync(before, 0o644)
          yield* file.chmod(0o600)
        }))
      expect(statSync(after).mode & 0o777).toBe(0o600)
      expect(statSync(before).mode & 0o777).toBe(0o644)
    })
  }

  test(`${name}: a nonBlocking open reads, writes, seeks, truncates and stats like Effect's`, async () => {
    const path = join(dir, "file")
    const result = await run(layer, (fs) =>
      Effect.gen(function*() {
        const file = yield* fs.open(path, { flag: "w+", nonBlocking: true, mode: 0o600 })
        yield* file.writeAll(new TextEncoder().encode("hello world"))
        expect(yield* file.write(new TextEncoder().encode("!"))).toBe(1)
        yield* file.sync
        expect(yield* file.seek(BigInt(6), "start")).toBe(BigInt(6))
        const rest = yield* file.readAlloc(5)
        const buffer = new Uint8Array(5)
        expect(yield* file.read(buffer, { position: BigInt(0) })).toBe(5)
        yield* file.truncate(5)
        const info = yield* file.stat
        expect(yield* file.seek(BigInt(-1), "current")).toBe(BigInt(4))
        const seekError = yield* Effect.flip(file.seek(BigInt(-10), "current"))
        const readError = yield* Effect.flip(file.read(buffer, { position: BigInt(-1) }))
        const sizeError = yield* Effect.flip(file.readAlloc(-1))
        return { rest: new TextDecoder().decode(Option.getOrThrow(rest)), head: new TextDecoder().decode(buffer), info, seekError, readError, sizeError }
      }))
    expect(result.rest).toBe("world")
    expect(result.head).toBe("hello")
    expect(result.info.type).toBe("File")
    expect(Number(result.info.size)).toBe(5)
    expect(result.info.mode & 0o777).toBe(0o600)
    expect(result.seekError.reason._tag).toBe("BadArgument")
    expect(result.readError.reason._tag).toBe("BadArgument")
    expect(result.sizeError.reason._tag).toBe("BadArgument")
    expect(readFileSync(path, "utf8")).toBe("hello")
  })

  test(`${name}: a nonBlocking open of a file being appended to writes at its end`, async () => {
    const path = join(dir, "log")
    writeFileSync(path, "one\n")
    await run(layer, (fs) =>
      Effect.gen(function*() {
        const file = yield* fs.open(path, { flag: "a", nonBlocking: true })
        yield* file.writeAll(new TextEncoder().encode("two\n"))
        expect(yield* file.write(new TextEncoder().encode("three\n"))).toBe(6)
        yield* file.truncate(8)
      }))
    expect(readFileSync(path, "utf8")).toBe("one\ntwo\n")
  })

  test(`${name}: a nonBlocking open of a FIFO returns at once, and stat reports it`, async () => {
    const fifo = join(dir, "fifo")
    mkfifo(fifo)
    const info = await run(layer, (fs) => Effect.flatMap(fs.open(fifo, { nonBlocking: true, noFollow: true }), (file) => file.stat))
    expect(info.type).toBe("FIFO")
    // With no reader, opening a FIFO to write fails at once (ENXIO).
    const error = await failure(layer, (fs) => fs.open(fifo, { flag: "w", nonBlocking: true }))
    expect(error.reason._tag).toBe("Unknown")
    expect(error.reason).toMatchObject({ method: "open", syscall: "open", pathOrDescriptor: fifo })
    expect((error.reason.cause as NodeJS.ErrnoException).code).toBe("ENXIO")
  })

  test(`${name}: nonBlocking with noFollow refuses a final symbolic link`, async () => {
    writeFileSync(join(dir, "target"), "")
    symlinkSync("target", join(dir, "link"))
    const error = await failure(layer, (fs) => fs.open(join(dir, "link"), { nonBlocking: true, noFollow: true }))
    expect(error.reason._tag).toBe("BadResource")
    expect((error.reason.cause as NodeJS.ErrnoException).code).toBe("ELOOP")
    const missing = await failure(layer, (fs) => fs.open(join(dir, "missing"), { nonBlocking: true }))
    expect(missing.reason._tag).toBe("NotFound")
  })

  test(`${name}: every other member is Effect's own`, async () => {
    writeFileSync(join(dir, "a.txt"), "text")
    const [effect, experimental] = await Effect.runPromise(Effect.provide(
      Effect.all([Effect.service(EffectFileSystem.FileSystem), Effect.service(FileSystem.FileSystem)]),
      layer
    ))
    for (const member of ["readFile", "readFileString", "writeFile", "stat", "lstat", "chmod", "stream", "makeTempDirectoryScoped"] as const) {
      expect(experimental[member]).toBe(effect[member] as never)
    }
    expect(await Effect.runPromise(experimental.readFileString(join(dir, "a.txt")))).toBe("text")
  })
}

test("open with nonBlocking fails with BadArgument where the platform lacks O_NONBLOCK, as noFollow does", async () => {
  const base = await Effect.runPromise(Effect.provide(Effect.service(EffectFileSystem.FileSystem), NodeFileSystem.layer))
  writeFileSync(join(dir, "file"), "")
  for (const [host, options, option] of [
    [{ platform: "win32", constants }, { nonBlocking: true }, "nonBlocking"],
    [{ platform: "linux", constants: { ...constants, O_NONBLOCK: undefined } }, { nonBlocking: true }, "nonBlocking"],
    [{ platform: "linux", constants: { ...constants, O_NONBLOCK: 0 } }, { nonBlocking: true }, "nonBlocking"],
    [{ platform: "linux", constants: { ...constants, O_NOFOLLOW: undefined } }, { nonBlocking: true, noFollow: true }, "noFollow"]
  ] as const) {
    const layer = Layer.succeed(FileSystem.FileSystem, extend(base, host))
    const error = await failure(layer, (fs) => fs.open(join(dir, "file"), options))
    expect(error.reason._tag).toBe("BadArgument")
    expect(error.message).toBe(`FileSystem.open: ${option} is not supported on this platform`)
  }
})

test("layerNoop: open fails with NotFound unless given, members come from Effect's makeNoop, and Effect's key gets the same stub", async () => {
  const layer = FileSystem.layerNoop({ readFileString: () => Effect.succeed("stub") })
  const lstat = await failure(layer, (fs) => fs.lstat("/x"))
  expect(lstat.message).toBe("NotFound: FileSystem.lstat (/x): No such file or directory")
  const open = await failure(layer, (fs) => fs.open("/x", { nonBlocking: true }))
  expect(open.message).toBe("NotFound: FileSystem.open (/x): No such file or directory")
  const access = await failure(layer, (fs) => fs.access("/x", { executable: true }))
  expect(access.message).toBe("NotFound: FileSystem.access (/x): No such file or directory")
  const [effect, experimental] = await Effect.runPromise(Effect.provide(
    Effect.all([Effect.service(EffectFileSystem.FileSystem), Effect.service(FileSystem.FileSystem)]),
    layer
  ))
  expect(effect).toBe(experimental)
  expect(await Effect.runPromise(effect.readFileString("/any"))).toBe("stub")

  const given = FileSystem.layerNoop({
    lstat: () => Effect.succeed({ type: "SymbolicLink" } as EffectFileSystem.File.Info),
    open: () => Effect.die("opened")
  })
  expect((await run(given, (fs) => fs.lstat("/x"))).type).toBe("SymbolicLink")
})
