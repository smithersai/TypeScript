# Platform globals in VibeLang

Node.js reaches a `.vibe` file only through Effect's services, which a layer provides, or by escaping to TypeScript: a hatch, a `module` block, or a `.ts` file. So Node.js's globals, such as `process`, `Buffer`, `require`, and `__dirname`, and the web's globals that do I/O or read the clock or randomness, such as `fetch`, `setTimeout`, `crypto`, `performance`, and `localStorage`, are not in scope in a `.vibe` file, and a `.vibe` file does not import a Node.js built-in module, such as `node:fs` or `fs`, as a value. Each use is EK4402, or EK4403 for a clock or randomness read, and the error names what replaces it. A type-only import, as in `import type { Server } from "node:http"`, stays allowed, and `.ts` files keep every global.

ECMAScript's built-ins stay: `Array`, `Map`, `Set`, `JSON`, `Math`, `Promise`, `Symbol`, `Date`, `Intl`, and the rest; `Date.now()`, `new Date()`, and `Math.random()` are EK4403. The web's pure helpers stay too, because they touch nothing outside the program: `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `structuredClone`, `AbortController`, `AbortSignal`, `Blob`, `FormData`, `Headers`, `Request`, `Response`, `Event`, `EventTarget`, `atob`, `btoa`, and the web streams.

## Replacements

Each row says what replaces a global or one of its members: an Effect API first, then VibeLang's experimental service where Effect lacks one, then the escape to TypeScript, with the reason. EK4402 reads the same table.

| Global | Use instead |
| --- | --- |
| `BroadcastChannel` | escape to TypeScript for now: Effect has no service for messages between browser tabs; a Worker carries messages to a worker. |
| `Buffer` | `new TextEncoder().encode(text)` |
| `Buffer.alloc` | `new Uint8Array(size)` |
| `Buffer.concat` | `new Uint8Array([...a, ...b])` |
| `Buffer.from` | `new TextEncoder().encode(text)` |
| `Bun` | escape to TypeScript for now: A runtime's own API belongs to its platform package's layers, such as @effect/platform-bun's, or to a .ts file. |
| `Deno` | escape to TypeScript for now: A runtime's own API belongs to its platform package's layers, such as @effect/platform-bun's, or to a .ts file. |
| `EventSource` | `HttpClient.get(url)` |
| `SharedWorker` | Worker and WorkerRunner |
| `WebSocket` | `Socket.makeWebSocket(url)` |
| `Worker` | Worker and WorkerRunner |
| `XMLHttpRequest` | `HttpClient.get(url)` |
| `__dirname` | `Path.dirname(Path.fromFileUrl(new URL(import.meta.url)))` |
| `__filename` | `Path.fromFileUrl(new URL(import.meta.url))` |
| `addEventListener` | `Stream.fromEventListener(target, "message")` |
| `alert` | escape to TypeScript for now: Effect has no service for the browser's dialogs; a terminal program asks with Terminal.readLine(). |
| `caches` | escape to TypeScript for now: Effect has no service for the browser's Cache Storage; KeyValueStore stores strings by key. |
| `cancelAnimationFrame` | escape to TypeScript for now: Effect has no service for the browser's animation and idle callbacks; schedule work with Schedule, or call them in a .ts file. |
| `cancelIdleCallback` | escape to TypeScript for now: Effect has no service for the browser's animation and idle callbacks; schedule work with Schedule, or call them in a .ts file. |
| `clearImmediate` | `fiber.interrupt()` |
| `clearInterval` | `fiber.interrupt()` |
| `clearTimeout` | `fiber.interrupt()` |
| `confirm` | escape to TypeScript for now: Effect has no service for the browser's dialogs; a terminal program asks with Terminal.readLine(). |
| `console` | `Console.log(message)` |
| `console.debug` | `Console.debug(message)` |
| `console.error` | `Console.error(message)` |
| `console.info` | `Console.info(message)` |
| `console.log` | `Console.log(message)` |
| `console.table` | `Console.table(rows)` |
| `console.trace` | `Console.trace(message)` |
| `console.warn` | `Console.warn(message)` |
| `crypto` | `Crypto.randomBytes(size)` |
| `crypto.createCipheriv` | escape to TypeScript for now: Effect's Crypto has random values and digests, and VibeLang's experimental Crypto adds HMAC and signatures; neither has ciphers or key generation. |
| `crypto.createDecipheriv` | escape to TypeScript for now: Effect's Crypto has random values and digests, and VibeLang's experimental Crypto adds HMAC and signatures; neither has ciphers or key generation. |
| `crypto.createHash` | `Crypto.digest("SHA-256", bytes)` |
| `crypto.createHmac` | `Experimental.Crypto.hmac("SHA-256", key, data)` |
| `crypto.createSign` | `Experimental.Crypto.sign("Ed25519", privateKey, data)` |
| `crypto.createVerify` | `Experimental.Crypto.verify("Ed25519", publicKey, signature, data)` |
| `crypto.generateKeyPair` | escape to TypeScript for now: Effect's Crypto has random values and digests, and VibeLang's experimental Crypto adds HMAC and signatures; neither has ciphers or key generation. |
| `crypto.getRandomValues` | `Crypto.randomBytes(size)` |
| `crypto.hash` | `Crypto.digest("SHA-256", bytes)` |
| `crypto.randomBytes` | `Crypto.randomBytes(size)` |
| `crypto.randomInt` | `Crypto.randomIntBetween(min, max)` |
| `crypto.randomUUID` | `Crypto.randomUUIDv4()` |
| `crypto.sign` | `Experimental.Crypto.sign("Ed25519", privateKey, data)` |
| `crypto.subtle` | `Experimental.Crypto.hmac("SHA-256", key, data)` |
| `crypto.subtle.digest` | `Crypto.digest("SHA-256", bytes)` |
| `crypto.subtle.sign` | `Experimental.Crypto.sign("Ed25519", privateKey, data)` |
| `crypto.subtle.verify` | `Experimental.Crypto.verify("Ed25519", publicKey, signature, data)` |
| `crypto.verify` | `Experimental.Crypto.verify("Ed25519", publicKey, signature, data)` |
| `crypto.webcrypto` | `Experimental.Crypto.hmac("SHA-256", key, data)` |
| `dispatchEvent` | `Stream.fromEventListener(target, "message")` |
| `document` | escape to TypeScript for now: Effect has no service for the DOM; UI code belongs in a .ts or .tsx file, such as a React component's. |
| `document.addEventListener` | `BrowserStream.fromEventListenerDocument("visibilitychange")` |
| `exports` | `export const name = value` |
| `fetch` | `HttpClient.get(url)` |
| `global` | `globalThis` |
| `history` | escape to TypeScript for now: Effect has no service for the DOM; UI code belongs in a .ts or .tsx file, such as a React component's. |
| `importScripts` | Worker and WorkerRunner |
| `indexedDB` | `KeyValueStore.get(key)` |
| `localStorage` | `KeyValueStore.get(key)` |
| `location` | escape to TypeScript for now: Effect has no service for the DOM; UI code belongs in a .ts or .tsx file, such as a React component's. |
| `module` | `export const name = value` |
| `navigator` | escape to TypeScript for now: Effect has no service for the browser's navigator; navigator.clipboard, geolocation, permissions, and locks have services. |
| `navigator.clipboard` | `Clipboard.readString()` |
| `navigator.geolocation` | `Geolocation.getCurrentPosition()` |
| `navigator.hardwareConcurrency` | `Experimental.Process.availableParallelism()` |
| `navigator.locks` | `Experimental.Locks.hold(name)` |
| `navigator.permissions` | `Permissions.query("geolocation")` |
| `performance` | `Clock.currentTimeMillis()` |
| `performance.now` | `Clock.monotonicTimeNanos()` |
| `performance.timeOrigin` | `Experimental.Process.timeOrigin()` |
| `process` | `Config.String("NAME")()` |
| `process.arch` | `Experimental.Process.arch()` |
| `process.argv` | `Stdio.args()` |
| `process.cwd` | `Path.resolve()` |
| `process.env` | `Config.String("NAME")()` |
| `process.execPath` | `Experimental.Process.execPath()` |
| `process.exit` | main's result: return or fail from main |
| `process.exitCode` | main's result: return or fail from main |
| `process.hrtime` | `Clock.monotonicTimeNanos()` |
| `process.kill` | `Experimental.Process.kill(pid, { killSignal })` |
| `process.memoryUsage` | `Experimental.Process.memoryUsage()` |
| `process.nextTick` | `yieldNow()` |
| `process.off` | escape to TypeScript for now: NodeRuntime.runMain handles SIGINT and SIGTERM; Effect has no service for other process events. |
| `process.on` | escape to TypeScript for now: NodeRuntime.runMain handles SIGINT and SIGTERM; Effect has no service for other process events. |
| `process.once` | escape to TypeScript for now: NodeRuntime.runMain handles SIGINT and SIGTERM; Effect has no service for other process events. |
| `process.pid` | `Experimental.Process.pid()` |
| `process.platform` | `Experimental.Process.platform()` |
| `process.removeListener` | escape to TypeScript for now: NodeRuntime.runMain handles SIGINT and SIGTERM; Effect has no service for other process events. |
| `process.stderr` | `Console.error(text)` |
| `process.stdin` | `Terminal.readLine()` |
| `process.stdout` | `Console.log(text)` |
| `process.uptime` | escape to TypeScript for now: Clock reads the time, not the process's age: keep a Clock.monotonicTimeNanos() reading from the start. |
| `process.version` | `Experimental.Process.versions()` |
| `process.versions` | `Experimental.Process.versions()` |
| `prompt` | escape to TypeScript for now: Effect has no service for the browser's dialogs; a terminal program asks with Terminal.readLine(). |
| `queueMicrotask` | `yieldNow()` |
| `removeEventListener` | `Stream.fromEventListener(target, "message")` |
| `requestAnimationFrame` | escape to TypeScript for now: Effect has no service for the browser's animation and idle callbacks; schedule work with Schedule, or call them in a .ts file. |
| `requestIdleCallback` | escape to TypeScript for now: Effect has no service for the browser's animation and idle callbacks; schedule work with Schedule, or call them in a .ts file. |
| `require` | `import { name } from "./module.ts"` |
| `require.resolve` | `import.meta.resolve(specifier)` |
| `self` | `globalThis` |
| `sessionStorage` | `KeyValueStore.get(key)` |
| `setImmediate` | `yieldNow()` |
| `setInterval` | `repeat(program, Schedule.spaced("1 second"))` |
| `setTimeout` | `sleep("1 second")` |
| `window` | escape to TypeScript for now: Effect has no service for the DOM; UI code belongs in a .ts or .tsx file, such as a React component's. |
| `window.addEventListener` | `BrowserStream.fromEventListenerWindow("resize")` |

## The replacements at work

Each call above, in code that compiles. A function that calls a service needs its layer in `main`, such as `NodeServices.layer` from `@effect/platform-node`:

```vibe
function replacements(
  path: string, text: string, url: string, key: string, specifier: string, message: string,
  size: number, min: number, max: number, bytes: Uint8Array, a: Uint8Array, b: Uint8Array,
  rows: ReadonlyArray<unknown>, target: EventTarget, program: void!!,
) {
  const name = Config.String("NAME")()
  const args = Stdio.args()
  const directory = Path.resolve()
  const here = Path.dirname(Path.fromFileUrl(new URL(import.meta.url)))
  const file = Path.fromFileUrl(new URL(import.meta.url))
  const resolved = import.meta.resolve(specifier)
  const line = Terminal.readLine()
  Console.log(message)
  Console.log(text)
  Console.error(message)
  Console.error(text)
  Console.warn(message)
  Console.info(message)
  Console.debug(message)
  Console.trace(message)
  Console.table(rows)
  const random = Crypto.randomBytes(size)
  const id = Crypto.randomUUIDv4()
  const roll = Crypto.randomIntBetween(min, max)
  const digest = Crypto.digest("SHA-256", bytes)
  const encoded = new TextEncoder().encode(text)
  const empty = new Uint8Array(size)
  const joined = new Uint8Array([...a, ...b])
  const response = HttpClient.get(url)
  const socket = Socket.makeWebSocket(url)
  const stored = KeyValueStore.get(key)
  const events = Stream.fromEventListener(target, "message")
  const millis = Clock.currentTimeMillis()
  const nanos = Clock.monotonicTimeNanos()
  sleep("1 second")
  yieldNow()
  const fiber = fork repeat(program, Schedule.spaced("1 second"))
  fiber.interrupt()
  const global = globalThis
  return { name, args, directory, here, file, resolved, line, random, id, roll, digest, encoded, empty, joined, response, socket, stored, events, millis, nanos, global }
}
```

In the browser, `@effect/platform-browser` supplies these services and their layers:

```vibe
import { BrowserStream, Clipboard, Geolocation, Permissions } from "@effect/platform-browser"

function browser() {
  const text = Clipboard.readString()
  const position = Geolocation.getCurrentPosition()
  const status = Permissions.query("geolocation")
  const resizes = BrowserStream.fromEventListenerWindow("resize")
  const visibility = BrowserStream.fromEventListenerDocument("visibilitychange")
  return { text, position, status, resizes, visibility }
}
```

VibeLang's experimental services fill what Effect lacks, provided by `ExperimentalNodeServices.layer` from `vibelang-runtime/experimental/platform-node` or Bun's, and `Locks` by `ExperimentalBrowserServices.layer` from `vibelang-runtime/experimental/platform-browser`; [Experimental platform APIs](../vibelang-features/118-experimental-platform-apis.md) has the details:

```vibe
function experimental(path: string, pid: number, killSignal: ChildProcess.Signal, name: string, key: Redacted<Uint8Array>, privateKey: Redacted<Uint8Array>, publicKey: Uint8Array, signature: Uint8Array, data: Uint8Array) {
  const id = Experimental.Process.pid()
  const platform = Experimental.Process.platform()
  const arch = Experimental.Process.arch()
  const executable = Experimental.Process.execPath()
  const versions = Experimental.Process.versions()
  const memory = Experimental.Process.memoryUsage()
  const host = Experimental.Process.hostname()
  const cores = Experimental.Process.availableParallelism()
  const origin = Experimental.Process.timeOrigin()
  Experimental.Process.kill(pid, { killSignal })
  const running = Experimental.Process.isRunning(pid)
  Experimental.FileSystem.access(path, { executable: true })
  const file = Experimental.FileSystem.open(path, { nonBlocking: true })
  const mac = Experimental.Crypto.hmac("SHA-256", key, data)
  const signed = Experimental.Crypto.sign("Ed25519", privateKey, data)
  const valid = Experimental.Crypto.verify("Ed25519", publicKey, signature, data)
  const lock = Experimental.Locks.hold(name)
  return { id, platform, arch, executable, versions, memory, host, cores, origin, running, file, mac, signed, valid, lock }
}
```

Modules load with declarations, not at run time. A `.vibe` file imports what `require` loaded:

```ts
// module.ts
export const name = "Ada"
```

```vibe
import { name } from "./module.ts"

function greeting() {
  return `Hello, ${name}`
}
```

and exports what CommonJS's `module.exports` and `exports` held:

```vibe
const value = 42
export const name = value
```

## Escaping to TypeScript

Where a row says to escape, write the TypeScript in a `module` block, whose body keeps every global, and run its function in a hatch:

```vibe
module dom {
  export function title(): string {
    return document.title
  }
}
import { title } from dom

function pageTitle() {
  return sync(() => title())
}
```

A `.vibe` file that needs a Node.js value, such as the `createServer` that `NodeHttpServer.layer` takes, imports it in a `module` block too:

```vibe
// fragment
// The snippet checker installs no @types/node, which declares node:http.
module node {
  import { createServer } from "node:http"
  export const server = createServer
}
import { server } from node
```


## Limits of static checks

EK4402 and EK4403 are static, lint-strength checks, not a sandbox or a
security boundary. They recognize direct uses, but aliases such as
`const g = globalThis; g.process.pid`, `as any`, and reflection through
`Reflect.get` can bypass them. Use process isolation when running untrusted
code.

`Intl.DateTimeFormat().format()` with no argument reads the current clock
without EK4403. Read time through `Clock.currentTimeMillis()` and pass that
value to the formatter when you need controlled time, including in tests.
