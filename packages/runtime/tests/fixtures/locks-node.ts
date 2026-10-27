// Runs locks-scenarios.ts under Node.js over ExperimentalNodeLocks.layer and prints what it observed.
//   node locks-node.ts scenarios           every scenario
//   node locks-node.ts reach               which contexts a held lock excludes: a worker thread, another process
//   node locks-node.ts trier <name>        tries <name> once and prints taken or refused
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Scope from "effect/Scope"
import { spawnSync } from "node:child_process"
import { parentPort, Worker } from "node:worker_threads"
import { Locks } from "vibelang-runtime/experimental"
import { ExperimentalNodeLocks } from "vibelang-runtime/experimental/platform-node"
import { contend, observe } from "./locks-scenarios.ts"

const [mode = "", name = ""] = process.argv.slice(2)
const file = new URL(import.meta.url).pathname

if (mode === "scenarios") {
  console.log(JSON.stringify(await Effect.runPromise(observe(ExperimentalNodeLocks.layer))))
} else if (mode === "trier") {
  await Effect.runPromise(contend(ExperimentalNodeLocks.layer, "trier", name, (event) => {
    if (parentPort === null) console.log(event)
    else parentPort.postMessage(event)
  }))
} else if (mode === "reach") {
  const lockName = `reach-${process.pid}`
  const reach = await Effect.runPromise(Effect.gen(function*() {
    const locks = yield* Locks.Locks
    const scope = yield* Scope.make()
    yield* locks.hold(lockName).pipe(Scope.provide(scope))
    const thread = yield* Effect.promise(() =>
      new Promise<string>((resolve, reject) => {
        const worker = new Worker(file, { argv: ["trier", lockName] })
        worker.once("message", resolve)
        worker.once("error", reject)
      })
    )
    const other = spawnSync(process.execPath, [file, "trier", lockName], { encoding: "utf8" })
    yield* Scope.close(scope, Exit.void)
    return { thread, process: other.stdout.trim() + other.stderr.trim() }
  }).pipe(Effect.provide(ExperimentalNodeLocks.layer)))
  console.log(JSON.stringify(reach))
} else {
  throw new Error(`unknown mode ${mode}`)
}
