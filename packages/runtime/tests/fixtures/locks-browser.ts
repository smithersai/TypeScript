// The page script of experimental-locks.test.ts: runs locks-scenarios.ts in Chromium
// over BrowserLocks.layer. `?role=scenarios` (the default) runs every scenario into
// `result`; any other role contends for `?name=` with other tabs, into `events`.
import * as Effect from "effect/Effect"
import { BrowserLocks } from "vibelang-runtime/experimental/platform-browser"
import { contend, observe } from "./locks-scenarios.ts"

const params = new URLSearchParams(location.search)
const role = params.get("role") ?? "scenarios"
const events: Array<string> = []
Object.assign(globalThis, { events })
if (role === "scenarios") {
  Effect.runPromise(observe(BrowserLocks.layer)).then(
    (result) => Object.assign(globalThis, { result }),
    (error: unknown) => Object.assign(globalThis, { failure: String(error) })
  )
} else {
  Effect.runFork(contend(BrowserLocks.layer, role, params.get("name") ?? "", (event) => events.push(event)))
}
