# Introduction to Effect Platform

VibeLang reaches files, paths, processes, HTTP, randomness, and terminals through Effect's platform services. Write the application against those services; the file that exports `main` names its platform once, and the entry provides that platform's implementations to `main`. Node's globals and the web's I/O globals are not in scope in a `.vibe` file, and it imports no `node:*` module as a value (EK4402); it needs no wrapper of its own around one.

## Using platform services

```vibe
// main.vibe
import "vibelang/platform/node"

export function main() {
  using directory = FileSystem.makeTempDirectoryScoped()
  const file = Path.join(directory, "greeting.txt")
  FileSystem.writeFileString(file, "Hello, VibeLang!")
  Console.log(FileSystem.readFileString(file))
  Console.log(ChildProcessSpawner.string(ChildProcess.make("echo", ["from a child process"])).trim())
}
// Output: Hello, VibeLang!
// Output: from a child process
```

Call a service through its module's name, with no import: `FileSystem.readFileString(file)` runs the service's method and returns the text, and its `PlatformError` joins E. The module's own exports keep their meaning, as `FileSystem.layerNoop` does; `FileSystem()` is the implementation, and the type `FileSystem` is the service ([Effect's modules](../getting-started/008-importing-effect.md#a-modules-own-export)). `import "vibelang/platform/node"` names the platform, so `main` writes no `provide`: when Node starts the module, it runs `main` with `NodeServices.layer` from `@effect/platform-node`, which supplies the services `main` needs (D312). The import loads nothing; the compiler removes it. The functions that call the services only require them, so a test provides others.

## Replacing Node.js and web calls

Each Node.js or web call has an Effect replacement, which needs no import. EK4402 and EK4403 name it and its layer:

| Call | Effect | Layer |
| --- | --- | --- |
| `fs.readFile` | `FileSystem.readFileString(path)` | `NodeServices.layer` |
| `os.tmpdir` | `FileSystem.makeTempDirectory()` | `NodeServices.layer` |
| `path.join` | `Path.join(directory, name)` | `NodeServices.layer` |
| `process.cwd` | `Path.resolve()` | `NodeServices.layer` |
| `child_process.execFileSync` | `ChildProcessSpawner.string(ChildProcess.make(command, args))` | `NodeServices.layer` |
| `fetch` | `HttpClient.get(url)` | `FetchHttpClient.layer` |
| `http.createServer` | `HttpRouter.serve(app)` | `NodeHttpServer.layer(createServer, { port })` |
| `crypto.randomUUID` | `Crypto.randomUUIDv4()` | `NodeServices.layer` |
| `crypto.subtle.digest` | `Crypto.digest("SHA-256", bytes)` | `NodeServices.layer` |
| `process.argv` | `Stdio.args()` | `NodeServices.layer` |
| `os.hostname` | `Experimental.Process.hostname()` | `NodeServices.layer` |
| `process.kill` | `Experimental.Process.kill(pid, { killSignal })` | `NodeServices.layer` |
| `fs.constants.X_OK` | `Experimental.FileSystem.access(path, { executable: true })` | `NodeServices.layer` |
| `crypto.createHmac` | `Experimental.Crypto.hmac("SHA-256", key, data)` | `NodeServices.layer` |
| `navigator.locks` | `Experimental.Locks.hold(name)` | `BrowserLocks.layer` |
| `process.env` | `Config.String("NAME")()` | none |
| `console.log` | `Console.log(message)` | none |
| `setTimeout` | `sleep("1 second")` | none |
| `Date.now` | `Clock.currentTimeMillis()` | none |
| `performance.now` | `Number(Clock.monotonicTimeNanos()) / 1e6` | none |
| `Math.random` | `Random.next()` | none |

Call a service through its module's name, as in `Crypto.randomUUIDv4()`; `ChildProcess`, `HttpClient`, `HttpRouter`, and `FetchHttpClient` are in scope too (D310). `NodeServices.layer` provides `FileSystem`, `Path`, `Crypto`, `Stdio`, `Terminal`, and `ChildProcessSpawner`; `BunServices.layer` from `@effect/platform-bun` is Bun's. The platform import provides the platform's bundle to `main`; provide every other layer inside `main`. Effect's runtime provides the prelude's services itself.

Where Effect has no service yet, as for `os.hostname()`, `process.pid`, an execute-permission check, HMAC and signatures, or `navigator.locks`, EK4402 names the experimental service VibeLang adds, such as `Experimental.Process.pid()` ([Experimental platform APIs](../vibelang-features/118-experimental-platform-apis.md)), whose layers come from `vibelang-runtime/experimental/platform-node`, `-bun`, or `-browser`. There, `NodeServices.layer` is `@effect/platform-node`'s bundle plus the experimental `FileSystem`, `Crypto`, and `Process`, so it replaces Effect's in `main`. Where nothing covers the call yet, as for `os.uptime()`, EK4402 says to escape to TypeScript: a `module` block or a `.ts` file that imports the API, or a hatch around a web global, as in `sync(() => document.title)`. [Platform globals](platform-globals.md) answers every Node.js and web global.

## Installing runtime-specific packages

```sh
npm install effect@4.0.6 @effect/platform-node
npm install vibelang-runtime
npm install --save-dev vibelang
```

The `effect` package holds the interfaces. Install `@effect/platform-node` for Node.js or Deno, `@effect/platform-bun` for Bun, or `@effect/platform-browser` for browsers, in a release compatible with the project's Effect version.

```sh
# Deno
deno add npm:effect@4.0.6 npm:@effect/platform-node

# Bun
bun add effect@4.0.6 @effect/platform-bun
```

`vibelang` ships the `vibelang` binary. `npx vibelang` checks and compiles the project's `.vibe` and `.ts` sources, then you launch the generated JavaScript; `npx vibelang --noEmit` only checks. Bun and Deno projects also need `vibelang-runtime` and the compiler. Never pass `.vibe` files to a TypeScript runner.

## Writing platform-independent programs

```vibe
// greeting.vibe
// run: provide FileSystem.layerNoop({ readFileString: () => "  Hello, VibeLang!\n" }) { greet() }
export function greet() {
  const greeting = FileSystem.readFileString("./greeting.txt")
  Console.log(greeting.trim())
}
// Output: Hello, VibeLang!
```

`greet` requires `FileSystem` and nothing else, so it runs on any platform that provides it, and a test provides a layer of its own, here the module's `FileSystem.layerNoop`. Shared modules name no platform; the entry file does.

## Supplying Node or Deno implementations

```vibe
// main-node.vibe
import "vibelang/platform/node"
import { greet } from "./greeting.vibe"

export function main() {
  FileSystem.writeFileString("./greeting.txt", "Hello, VibeLang!")
  greet()
}
// Output: Hello, VibeLang!
```

`import "vibelang/platform/node"` names Node and `main` needs `FileSystem`, so the compiled module runs `main` as Effect's canonical entry does, `NodeRuntime.runMain(Effect.provide(main(), NodeServices.layer))`, with the Node platform service bundle. `"vibelang/platform/bun"` names Bun's bundle and `"vibelang/platform/browser"` the browser's; the services each bundle supplies come from its installed declarations. The same package works in Deno's Node compatibility environment, subject to Deno permissions. Run the generated entry module with Node or Deno, granting only the permissions the application needs.

A `provide` inside `main` wins for the code inside it, so `provide NodeFileSystem.layer { ... }` replaces one service. Tests never run the entry: they import `main` and provide their own layers. EK3205 names any other service `main` needs; provide it inside `main`. Without a platform import the entry provides no platform, and EK3205 names the import that would.

## Supplying Bun implementations

```vibe
// main-bun.vibe
import "vibelang/platform/bun"
import { greet } from "./greeting.vibe"

export function main() {
  FileSystem.writeFileString("./greeting.txt", "Hello, VibeLang!")
  greet()
}
// Output: Hello, VibeLang!
```

The entry provides `BunServices.layer` from `@effect/platform-bun`. Only the platform import changes; the same `greet` uses Bun's implementations. A target-specific package can supply a narrower layer than the whole bundle, such as `NodeFileSystem.layer`. The FileSystem, Path, PlatformLogger, Runtime, and Terminal pages cover each integration.

## Coming from Effect

A module's name names its service: `FileSystem.readFileString(path)` is `yield* FileSystem.FileSystem` followed by the method call. An exported `main` in a file that imports `"vibelang/platform/node"` compiles to `NodeRuntime.runMain(main.pipe(Effect.provide(NodeServices.layer)))`, and `provide layer { ... }` is `Effect.provide(program, layer)`. Functions run on call, platform methods return success values directly, and no generator wraps the application.
