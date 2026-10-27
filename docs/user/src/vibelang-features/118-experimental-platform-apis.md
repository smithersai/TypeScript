# Experimental platform APIs

VibeLang adds the few platform APIs that Effect does not have yet. They are experimental: a release can change or remove them, and each goes when Effect ships the API. Where Effect has the service, the experimental one extends it, so the rest of the service is Effect's own; where Effect has none, the experimental service follows Effect's style.

| Service | Adds | Layers |
| --- | --- | --- |
| `Experimental.FileSystem` | `access(path, { executable })`, `open(path, { nonBlocking })`, `File.chmod` | Node, Bun |
| `Experimental.Crypto` | `hmac`, `sign`, `verify` | Node, Bun, browser |
| `Experimental.Process` | the process id, platform, host name and other facts; `kill`, `isRunning` | Node, Bun |
| `Experimental.Locks` | `hold`, `tryHold`, `query` over Web Locks | browser; Node within one process |

`Experimental` is in scope in every `.vibe` file without an import, as Effect's modules are. A local declaration or an import named `Experimental` shadows it. TypeScript imports the same modules from `vibelang-runtime/experimental`, or one module from its subpath, such as `vibelang-runtime/experimental/FileSystem`.

## How they work

Each experimental service has its own key, such as `Experimental.FileSystem.FileSystem`. Call a service through its module's name, as you call Effect's (D311): `Experimental.FileSystem.access(path, { executable: true })` calls the experimental `FileSystem` service, `Experimental.FileSystem()` is its implementation, and the type `Experimental.FileSystem` is the service, which a contract's requirements name: `boolean!PlatformError!Experimental.FileSystem`.

The experimental `FileSystem` and `Crypto` keys are class services, as Effect declares them: their implementations, `Experimental.FileSystem.Service` and `Experimental.Crypto.Service`, are Effect's interfaces plus the new members, and the services themselves are not Effect's. A layer of Effect's `FileSystem` or `Crypto` therefore never provides the experimental one, in VibeLang and in stock TypeScript alike, because at run time it provides a different key. Type an implementation as `Experimental.FileSystem.Service`. `Process` and `Locks` extend nothing, so their type is both the service and its implementation, as Effect's `FileSystem` is. The module's own exports keep their meaning, as `Experimental.FileSystem.layerNoop` does. An import by name from the subpath, `import { FileSystem } from "vibelang-runtime/experimental/FileSystem"`, works too, and shadows the prelude's `FileSystem`.

Provide a platform layer in `main`. The layers live beside Effect's platform packages. A layer of a service that extends Effect's provides the experimental service and Effect's service of the same name from one implementation, so code that uses Effect's `FileSystem` and code that uses the additions share it:

| Module | Layers |
| --- | --- |
| `vibelang-runtime/experimental/platform-node` | `NodeServices.layer`: `@effect/platform-node`'s bundle plus `FileSystem`, `Crypto` and `Process`; `NodeFileSystem.layer`, `NodeCrypto.layer`, `NodeProcess.layer`; `NodeLocks.layer`, within one process |
| `vibelang-runtime/experimental/platform-bun` | `BunServices.layer`: `@effect/platform-bun`'s bundle plus `FileSystem`, `Crypto` and `Process`; `BunFileSystem.layer`, `BunCrypto.layer`, `BunProcess.layer` |
| `vibelang-runtime/experimental/platform-browser` | `BrowserServices.layer`: `Crypto` and `Locks`; `BrowserCrypto.layer`, `BrowserLocks.layer` |

The experimental `NodeServices.layer` replaces `@effect/platform-node`'s: it provides every service Effect's does. The runtime lists `@effect/platform-node`, `@effect/platform-bun` and `@effect/platform-browser` as optional peer dependencies: install the one your program runs on. Failures are Effect's `PlatformError`, as for Effect's services.

## FileSystem

| Member | What it does | Node.js |
| --- | --- | --- |
| `access(path, { executable: true })` | Checks that the caller may run the file; on Windows, only that it exists | `fs.access(path, X_OK)` |
| `open(path, { nonBlocking: true })` | Opens a FIFO or a device without waiting for the other end; Windows fails with `BadArgument` | `O_NONBLOCK` |
| `file.chmod(mode)` | Changes the permissions of the file the handle opened, even after its path was renamed or replaced | `FileHandle.chmod` |

```vibe
// run: provide NodeServices.layer { Console.log(JSON.stringify(runnable())) }
import { NodeServices } from "vibelang-runtime/experimental/platform-node"

function canRun(path: string) {
  Experimental.FileSystem.access(path, { executable: true })
  return true
}

function runnable() {
  using dir = FileSystem.makeTempDirectoryScoped()
  FileSystem.writeFileString(`${dir}/build.sh`, "#!/bin/sh")
  FileSystem.chmod(`${dir}/build.sh`, 0o755)
  FileSystem.writeFileString(`${dir}/notes.txt`, "")
  return { script: canRun(`${dir}/build.sh`) catch false, notes: canRun(`${dir}/notes.txt`) catch false }
}
// Output: {"script":true,"notes":false}
```

`lstat`, which reads a symbolic link itself, is Effect's own since Effect 4.0.6, so it needs no experimental service.

`noFollow` with `nonBlocking` opens a path that another process may replace: the open fails on a symbolic link and returns at once on a FIFO, and `file.chmod` then changes the file that was opened, not whatever the path names later.

```vibe
function restrict(path: string) {
  using file = Experimental.FileSystem.open(path, { flag: "r+", noFollow: true, nonBlocking: true })
  file.chmod(0o600)
}
```

In tests, `Experimental.FileSystem.layerNoop({ ... })` provides a stub for both keys: Effect's `FileSystem.layerNoop`, with `open` failing with `NotFound` unless you give it.

## Crypto

| Member | What it does |
| --- | --- |
| `hmac(algorithm, key, data)` | The HMAC of `data` with a `"SHA-1"`, `"SHA-256"`, `"SHA-384"` or `"SHA-512"` digest; `key` is the raw secret, `Redacted<Uint8Array>` |
| `sign(algorithm, privateKey, data)` | Signs `data`; `privateKey` is a PKCS#8 DER key, `Redacted<Uint8Array>` |
| `verify(algorithm, publicKey, signature, data)` | `true` when `signature` signs `data`; `publicKey` is an SPKI DER key |

The signature algorithms are `"ECDSA-P256-SHA256"`, whose signatures are 64 bytes, r then s, as WebCrypto writes them, and `"Ed25519"`. A key of the wrong kind fails with `BadArgument`, whose message names no key bytes. Secret keys are `Redacted`, so logs and errors print `<redacted>`. One WebCrypto implementation serves every platform.

```vibe
// run: provide NodeServices.layer { Console.log(signature(Redacted.make(new TextEncoder().encode("Jefe")), "what do ya want for nothing?")) }
import { NodeServices } from "vibelang-runtime/experimental/platform-node"

function signature(secret: Redacted<Uint8Array>, body: string) {
  return Hex.encode(Experimental.Crypto.hmac("SHA-256", secret, new TextEncoder().encode(body)))
}
// Output: 5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843
```

`Experimental.Crypto.layerTest()` provides both keys for tests: random bytes are zeros, so UUIDs repeat, and digests, HMACs and signatures are real.

## Process

```vibe
// alive.vibe
import { NodeServices } from "vibelang-runtime/experimental/platform-node"

export function main() {
  provide NodeServices.layer {
    const pid = Experimental.Process.pid()
    Console.log(Experimental.Process.isRunning(pid))
  }
}
// Output: true
```

Each fact is an Effect that cannot fail, read with a call, as `Stdio.args()` is:

| Call | Gives | Replaces |
| --- | --- | --- |
| `Experimental.Process.pid()` | `ProcessId`, Effect's child process id type | `process.pid` |
| `Experimental.Process.platform()` | `"darwin"`, `"linux"`, `"win32"`, ... | `process.platform` |
| `Experimental.Process.arch()` | `"x64"`, `"arm64"`, ... | `process.arch` |
| `Experimental.Process.execPath()` | the runtime's executable | `process.execPath` |
| `Experimental.Process.versions()` | `{ node: "26.5.0", ... }` | `process.versions` |
| `Experimental.Process.hostname()` | the host's name | `os.hostname()` |
| `Experimental.Process.availableParallelism()` | at least 1 | `os.availableParallelism()` |
| `Experimental.Process.timeOrigin()` | when the process started, in epoch milliseconds | `performance.timeOrigin` |
| `Experimental.Process.memoryUsage()` | `{ rss, heapTotal, heapUsed, external, arrayBuffers }` in bytes | `process.memoryUsage()` |

The user's home directory is Effect's own, `UserDirectories.home()`, which needs no import (D310), provided by `UserDirectories.layer`. A browser has no process to read, so `Process` has no browser layer.

### Signalling processes

```vibe
// stop.vibe
import { NodeServices } from "vibelang-runtime/experimental/platform-node"

function stop(pid: number) {
  if (!Experimental.Process.isRunning(pid)) return "already stopped"
  Experimental.Process.kill(pid, { killSignal: "SIGTERM" })
  return "stopped"
}

export function main() {
  provide NodeServices.layer {
    using child = ChildProcessSpawner.spawn(ChildProcess.make("sleep", ["30"]))
    Console.log(stop(child.pid))
    Console.log(Experimental.Process.kill(4194000) catch (e) => e.reason._tag)
  }
}
// Output: stopped
// Output: NotFound
```

`Experimental.Process.kill(pid, { killSignal, group })` sends `killSignal`, `"SIGTERM"` by default, one of Effect's `ChildProcess.Signal` names. `Experimental.Process.isRunning(pid, { group })` sends signal 0: a process that belongs to another user still runs, and so does a child that exited before its parent reaped it. `group: true` signals the process group whose id is `pid`, as `ChildProcessSpawner` starts each child in one. A child the program spawned also stops with its handle's `kill()`; `Experimental.Process.kill` reaches any process, such as one named in a pid file. One `NodeServices.layer` provides both `ChildProcessSpawner` and `Process`.

Both fail with a `PlatformError` whose reason says why:

| Reason | When |
| --- | --- |
| `NotFound` | No process has that id. |
| `PermissionDenied` | This process may not signal it. |
| `BadArgument` | `pid` is not a positive integer, the platform has no such signal, or `group` on Windows. |

### Testing with `Experimental.Process.layerTest`

```vibe
// platform-name.vibe
// run: provide Experimental.Process.layerTest({ platform: Effect.succeed("win32") }) { Console.log(platformName()) }
export function platformName() {
  return Experimental.Process.platform() === "win32" ? "Windows" : "POSIX"
}
// Output: Windows
```

`layerTest` takes the members a test sets and fixes the rest: `pid` is 1, `platform` is `"linux"`, `hostname` is `"localhost"`, `isRunning` answers `false`, and `kill` fails with `NotFound`.

## Locks

```vibe
// leader.vibe
// run: provide Experimental.Locks.layerTest({ hold: () => Effect.succeed({ lost: Effect.void }) }) { lead("engine") }
export function lead(name: string) {
  using held = Experimental.Locks.hold(name, { steal: true })
  Console.log(`leading ${name}`)
  held.lost()
  Console.log("another tab took the lock")
}
// Output: leading engine
// Output: another tab took the lock
```

`Locks` holds exclusive [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), shared by the tabs and workers of one origin:

| Call | Gives | Replaces |
| --- | --- | --- |
| `Experimental.Locks.hold(name)` | `Held`, once this context holds the lock | `navigator.locks.request(name, callback)` |
| `Experimental.Locks.hold(name, { steal: true })` | `Held`, at once, taken from its holder | `request(name, { steal: true }, callback)` |
| `Experimental.Locks.tryHold(name)` | `Option<Held>`, at once: none when another context holds the lock or waits for it | `request(name, { ifAvailable: true }, callback)` |
| `Experimental.Locks.query()` | `{ held, pending }`, each lock's `name`, `mode`, and `clientId` | `navigator.locks.query()` |

A held lock belongs to the block's scope: `using` releases it when the block ends, and a closed or crashed tab releases its locks, which hands each to the next tab waiting. Interrupting a wait withdraws the request. `held.lost()` completes when another context steals the lock. A lock manager that refuses a request fails it with a `PlatformError`: `BadArgument` for a name that starts with `-`, `PermissionDenied` where the page is not a secure context.

`BrowserLocks.layer`, also in `BrowserServices.layer`, uses `navigator.locks`. Node.js has Web Locks too, but they coordinate the main thread and the worker threads of one process, never two processes, so `NodeLocks.layer` is not in the Node.js bundle: provide it only for locks within one process. Bun has no Web Locks and no layer. `Experimental.Locks.layerTest()` grants every request at once and never loses a lock; pass the members a test needs, as above.

## When Effect ships them

Each addition has a matching change prepared for Effect. When an Effect release has the member, the experimental module re-exports Effect's, and a later VibeLang release removes the module (D313).
