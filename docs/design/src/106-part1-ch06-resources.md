### 6. Resources

#### `using`

`using` acquires a resource and releases it when the enclosing block exits, on success, failure, or interruption. It is standard JavaScript syntax (Explicit Resource Management reached Stage 4 on 2026-05-19, for ES2027) with Effect's guarantees added.

```ts effect
const readReport = Effect.fn("readReport")(
  function* (path: string) {
    const files = yield* Files
    const file = yield* files.open(path)
    const text = yield* file.readAll()
    return yield* parseReport(text)
  },
  Effect.scoped
)
```

```ts es
function readReport(path: string) {
  using file = Files.open(path)
  return parseReport(file.readAll())
}
// Report!IOError | ParseError!Files
```

`Files.open` returns a scoped resource: `FileHandle!IOError!Scope`. The block that declares `using` supplies the `Scope`, so `Scope` is not in `readReport`'s requirements. Several `using` declarations release in reverse order.

#### Exactly one release

Every `using` declaration releases its resource exactly once, and exactly one party owns that release (D342). The initializer decides which party:

| Initializer | Example | Who releases it | What `using` adds |
| --- | --- | --- | --- |
| A **scoped acquisition**: an expression whose requirements include `Scope` | `Files.open(path)`, `Effect.acquireRelease(…)`, `Effect.acquireDisposable(…)` | The acquisition, through the release it registers in the block's Scope | Nothing: it supplies the block's Scope, and adds no release, no disposal call, and no mask |
| Any other expression, whose value is a `Disposable`, an `AsyncDisposable`, `null`, or `undefined` | `new TempDir()`, `openDisposable()` | `using`, through one disposal it registers | One disposal, registered before any interruption can arrive |

**A scoped acquisition owns its release.** `using` evaluates the initializer with the block's Scope as its Scope. The acquisition registers its own release, and it decides whether cancellation can reach the acquisition (below). `using` never calls `[Symbol.dispose]` or `[Symbol.asyncDispose]` on a scoped acquisition's value, even when the value has one: a scoped acquisition that returns a `Disposable` disposes it itself, as `Effect.acquireDisposable` does. So this closes the file once:

```ts es
function firstLine(path: string) {
  using file = Effect.acquireRelease(
    () => openFile(path),                       // returns a Disposable
    (file) => file[Symbol.dispose]()            // the acquisition's release: the only one
  )
  return file.readLine()
}
```

**Otherwise `using` owns the disposal.** The value must be a `Disposable`, an `AsyncDisposable`, `null`, or `undefined`; anything else is TypeScript's TS2850. `using` reads the value's disposal method once, when it registers it: `[Symbol.asyncDispose]` if the value has one, otherwise `[Symbol.dispose]`, as ECMAScript's `await using` and `Effect.acquireDisposable` choose (D343). At block exit it calls that method, with the value as `this`, and waits for a returned promise. Replacing the method on the value later changes nothing. `null` and `undefined` register nothing. A value with neither method, which only a cast can produce, fails at the declaration with a `TypeError`, a defect, as ECMAScript's `using` does.

**No interruption separates a value from its release.** When evaluating the initializer cannot pause, the value and its registration happen in one step, so no interruption can arrive between them. When it can pause, because it calls an Effect function, `using` holds interruption off from the start of the initializer until the disposal is registered, as `Effect.acquireDisposable` holds it off around its acquisition. A pending interruption is delivered right after, and the release runs. To let cancellation reach a long wait, define the resource as a scoped acquisition that passes `{ interruptible: true }` (below).

**The release runs once.** It runs when the block exits by any path: return, jump, expected failure, defect, interruption, or abandonment. It runs with interruption held off, after the releases of `using` declarations and forked fibers that come later in the block. A release that throws or rejects is a defect, and the finalization rule combines it with the block's own failure (Chapter 17). Prior art agrees on once: ECMAScript's `DisposableStack`, C#'s `using`, Python's `with`, and Effect's `acquireRelease` each run one release per acquisition.

In `for (using item of values)`, each iteration owns a Scope region, including `using` and `fork` inside its body (D95). The item is released after the body's resources, before closing an iterator, producer, or Stream on early exit. In `for (using h = acquire(); condition; step)`, the head is acquired once in a Scope region around the whole loop and released when that loop exits, in reverse declaration order. Both forms release on success, typed failure, defect, interruption, and jumps out of their region. Labels retain their JavaScript `break` and `continue` targets. `for concurrent` takes `const` in its head; put `using` inside its body for per-item ownership. `for await` is EK1003: `for...of` over a producer or Stream already waits. `using` at a module's top level is EK1004.

#### Who owns a resource

Only `using` acquisitions belong to the block. A resource acquired without `using` belongs to the caller, even when the same block also has a `using`:

```ts es
function openAndLog(url: string) {
  const connection = Database.connect(url)      // no `using`: the caller owns it
  using log = Logs.open("connect.log")          // `using`: this block owns it
  log.write(`connected to ${url}`)
  return connection                             // still open when it reaches the caller
}
// Connection!ConnectError | IOError!Database | Logs | Scope
```

`log` closes when `openAndLog` returns. `connection` stays open, and `Scope` in the contract says the caller supplies the scope that will close it:

```ts es
function openLog(day: string) {
  return Files.open(`/var/log/app-${day}.log`)    // no `using`: the caller owns the file
}
// FileHandle!IOError!Files | Scope

function compareLogs(a: string, b: string) {
  using left = openLog(a)
  using right = openLog(b)
  return diffLines(left.readAll(), right.readAll())
}
// Diff!IOError!Files; both files close when compareLogs returns
```

`Scope` in a contract is an obligation, not a proof: it says who must close a resource, and the compiler checks that someone does. It does not stop a value from outliving its scope. A handle that a block acquired with `using` and then returns is already closed when the caller receives it, and using it fails as the resource fails, typically with a defect.

A `using` in a layer block's setup follows the same rule: it belongs to the setup's block, so its resource is released when the setup returns, before any member runs (D344). A resource that must live as long as the layer is acquired without `using`, in the layer's own Scope (Chapter 4).

#### Defining a resource

Write the acquire and release steps with Effect's `acquireRelease`:

```ts es
function lease(name: string) {
  return Effect.acquireRelease(
    () => Locks.acquire(name),        // acquire
    (lock) => Locks.release(lock)     // release: always runs, exactly once
  )
}
// Lock!LockError!Locks | Scope
```

The release is registered before anything else can happen, so a cancelled request never leaks a lock. A release runs its cleanup by calling it: a release written `(lock) => releaseProgram`, which returns a program instead of running it, would never release, and returning a program where the release's success type names no value is EK4802, an error (Chapter 13); write `(lock) => releaseProgram()`. By default the acquire step is also masked: an interruption that arrives while it runs waits for it to finish, then the release runs. That suits a quick step such as taking a lock or opening a file. An acquisition that waits on the outside world, such as a connection that may never complete, passes `{ interruptible: true }` so cancellation reaches the wait, as the adapter below does.

For a scoped acquisition, `using` adds no policy of its own: it supplies the block's Scope, and the resource's `acquireRelease` decides whether acquisition can be interrupted (D25). `using` holds interruption off only for an initializer whose disposal it owns, as the rules above say.

#### Resources and handlers

A resource held by code that a handler stops (Chapter 9) is released when it stops: if a handler doesn't continue your function, every `using` and `finally` between the handler and your code runs before the handler returns.

#### Adapting a callback API

Wrapping a callback-based API is boundary code; it belongs in TypeScript, using the runtime's `suspend`. Unlike the `callback` hatch, `suspend` tells the producer when a value arrived too late, so the producer can release it:

```ts ts
// net-adapter.ts
import { Effect } from "effect"
import { suspend } from "vibelang-runtime"
import * as net from "node:net"

export const connect = (host: string, port: number) =>
  Effect.acquireRelease(
    suspend<net.Socket>((waiter) => {
      const socket = net.connect(port, host)
      socket.once("connect", () => {
        if (!waiter.resume(socket)) socket.destroy()   // the waiter was cancelled first: still ours
      })
      return () => socket.destroy()                    // cancelled while connecting
    }, { release: (socket) => socket.destroy() }),     // accepted, but cancelled before delivery
    (socket) => Effect.sync(() => socket.destroy()),
    { interruptible: true }                            // cancellation reaches the wait
  )
```

```ts es
import { connect } from "./net-adapter.ts"

function session(host: string) {
  using socket = connect(host, 5432)
  return handshake(socket)
}

function sessionWithin(host: string) {
  return timeout(() => session(host), "2 seconds")    // cancels a connect that hangs
}
```

The two acquisition policies differ when cancellation arrives during the wait:

| Acquisition | Cancellation during the wait | Who releases a value that arrives late |
| --- | --- | --- |
| Masked (the default) | Waits for the value, registers its release, then releases it | Effect, through the registered release |
| `{ interruptible: true }` | Wins at once: the registration's cleanup runs and the fiber moves on | The producer, when `resume` returns `false`; the runtime, through `release`, for a value accepted but not yet delivered |

Without `{ interruptible: true }`, `sessionWithin` would wait for a connection that never completes, and the race branches in the adapter would never run (Chapter 21).

Adapt a callback API that hands over a plain value, not a resource, in `.vibe` with the `callback` hatch (D148). Its register function is plain, self-contained TypeScript, so it can call the SDK directly, and it takes the file's values as inputs before `resume` (D230). `resume(value)` succeeds, `resume.fail(error)` fails, `resume.exit(exit)` adopts an `Exit`, and a function it returns runs on interruption:

```ts es
import { onceReady } from "./sdk.ts"     // (callback: (sdk: Sdk) => void) => void

function ready() {
  return callback<Sdk>((resume) => {
    onceReady((sdk) => resume(sdk))
  })
}
// Sdk!!
```

Only `suspend` reports a lost race, so an adapter for a value that needs releasing stays in TypeScript, as above.
