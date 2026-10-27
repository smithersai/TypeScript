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

Every `using` declaration releases its resource exactly once, through exactly one owner (D342, D401). For `using x = e` [Rule]:

1. **The Scope.** `using` evaluates `e`, and runs a program that `e` runs, with the block's Scope as its Scope, so every release an acquisition in `e` registers there runs once when the block exits.
2. **The owner of the value.** When `e` gives its value `v`, at run time:
   - If an acquisition recorded that it registered the release of `v` itself in the block's Scope, the acquisition owns `v`, and `using` adds nothing.
   - Otherwise, if `v` has a disposal method, `using` owns its one disposal. It reads the method once, when it registers the disposal: `[Symbol.asyncDispose]` if `v` has one, otherwise `[Symbol.dispose]`, as ECMAScript's `await using` and `Effect.acquireDisposable` choose (D343). At block exit it calls that method with `v` as `this` and waits for a returned promise. Replacing the method on `v` later changes nothing.
   - Otherwise nothing more happens if `v` is `null` or `undefined`, or if `e` requires `Scope`: then `using` cannot release `v`, and whatever releases it is what its acquisition registered in the block's Scope. Any other value, which only a cast can produce, fails at the declaration with a `TypeError`, a defect, as ECMAScript's `using` does.
3. **Acquisitions.** Only an acquisition records ownership: `vibelang-runtime`'s `acquireRelease` and `acquireDisposable`, which take Effect's arguments and do what Effect's do, and which TypeScript code calls. In VibeLang code every reference that resolves to Effect's `Effect.acquireRelease` or `Effect.acquireDisposable` (rule H4), a call or a value, denotes the runtime's recording form. Each registers the release of the value it returns and records that, in one uninterruptible step. Nothing else records ownership: not `Scope` in a contract, which may be wider than its body needs (Chapter 14), and not a release registered for another value.
4. **Static check.** `e`'s type must be a `Disposable`, an `AsyncDisposable`, `null`, `undefined`, or a union of them, as TypeScript's TS2850 requires, unless `e` requires `Scope`. `Scope` in `e`'s requirements lets `using` bind a value it cannot dispose; it never decides who releases a value it can.

So this closes the file once: the acquisition records `file`, and `using` adds no disposal.

```ts es
function firstLine(path: string) {
  using file = Effect.acquireRelease(
    () => openFile(path),                       // returns a Disposable
    (file) => file[Symbol.dispose]()            // the acquisition's release: the only one
  )
  return file.readLine()
}
```

And this disposes the lease once, although `lease`'s contract names `Scope`: nothing recorded the lease, so `using` owns its disposal.

```ts es
class Lease {
  [Symbol.dispose](): void {
    released.push("lease")
  }
}

function lease(): Lease!!Scope {                // Scope written, nothing registered
  return new Lease()
}

function hold() {
  using held = lease()                          // disposed once, when hold returns
}
```

**No interruption separates a value from its release.** When evaluating `e` cannot pause, the value and its registration happen in one step, so no interruption can arrive between them. When it can pause and its value may be an object, so that `using` may own the value, `using` holds interruption off from the start of `e` until the value's owner is settled, as `Effect.acquireDisposable` holds it off around its acquisition (D425). The value may be an object unless `e`'s value type admits only `null`, `undefined`, `void`, `never`, and primitive types (`string`, `number`, `bigint`, `boolean`, `symbol`, and their literal types). `object`, `unknown`, `any`, a type parameter, and an object type that declares no disposal method all hold interruption off, since a value of any of them can carry a disposal method at run time, as a `Lease` returned as `object` does. A pending interruption is delivered right after, and the release runs. An acquisition inside `e` that passes `{ interruptible: true }` keeps that policy for its acquire step: `using`'s mask does not cover the step, because the acquisition registers and records the release itself (D401). So cancellation cannot reach a pause in such an initializer, such as a retry's backoff, except an interruptible acquisition's acquire step: write the waiting before the `using`, or acquire with `{ interruptible: true }`. When `e`'s value type admits only primitives, `null`, and `undefined`, `using` can never own the value, holds nothing off, and the acquisition's own policy alone decides whether cancellation reaches it (D25).

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

An acquisition decides whether its acquire step can be interrupted, inside `using` as outside it (D25, D401). `using` holds interruption off only around an initializer whose value it may own, as the rules above say.

#### Resources and handlers

A resource held by code that a handler stops (Chapter 9) is released when it stops: if a handler doesn't continue your function, every `using` and `finally` between the handler and your code runs before the handler returns.

#### Adapting a callback API

Wrapping a callback-based API is boundary code; it belongs in TypeScript, using the runtime's `suspend`. Unlike the `callback` hatch, `suspend` tells the producer when a value arrived too late, so the producer can release it:

```ts ts
// net-adapter.ts
import { Effect } from "effect"
import { acquireRelease, suspend } from "vibelang-runtime"
import * as net from "node:net"

export const connect = (host: string, port: number) =>
  acquireRelease(                                      // the runtime's: records the socket's release (D401)
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

Without `{ interruptible: true }`, `sessionWithin` would wait for a connection that never completes, and the race branches in the adapter would never run (Chapter 21). A `net.Socket` has `[Symbol.asyncDispose]`, so `using` would dispose it too if nothing had recorded its release; the runtime's `acquireRelease` records it, so the socket is destroyed once, and keeps its `{ interruptible: true }` policy inside `using`. Effect's own `Effect.acquireRelease`, called from TypeScript, records nothing (Chapter 26's trusted base).

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
