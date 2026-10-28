// One suite runs against the VibeLang Worker and its Effect TypeScript original,
// with an in-memory R2 bucket: no Cloudflare account, credentials or network.
import * as Cloudflare from "@alchemy.run/cloudflare"
import { Stack } from "alchemy"
import { Effect, Layer } from "effect"
import { HttpClientRequest, HttpServerRequest } from "effect/http"
import { describe, expect, test } from "vitest"
import * as Vibe from "../src/api.vibe"
import VibeStack from "../src/stack.vibe"
import * as Original from "../ts/api.ts"
import OriginalStack from "../ts/stack.ts"

// The bucket client the binding hands the Worker, backed by a Map.
const memoryBucket = (store: Map<string, string>) => ({
  get: (key: string) =>
    Effect.succeed(store.has(key) ? { text: () => Effect.succeed(store.get(key)!) } : null),
  put: (key: string, value: string) => Effect.sync(() => void store.set(key, value))
})

// Bucket("Notes") declares a resource, which reads the enclosing Stack.
// The CLI provides it; a test supplies an empty one.
const testLayer = (store: Map<string, string>) =>
  Layer.mergeAll(
    Layer.succeed(Cloudflare.R2.ReadWriteBucket, () => Effect.succeed(memoryBucket(store) as never)),
    Layer.succeed(Stack, { name: "test", stage: "test", resources: {}, bindings: {}, actions: {} })
  )

const send = (fetch: Effect.Effect<any, any, any>, request: HttpClientRequest.HttpClientRequest) =>
  Effect.provideService(fetch, HttpServerRequest.HttpServerRequest, HttpServerRequest.fromClientRequest(request))

const text = (response: { body: any }) => new TextDecoder().decode(response.body.body)

const run = (makeApi: Effect.Effect<any, any, any>, store: Map<string, string>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const { fetch } = yield* makeApi
      const put = yield* send(fetch, HttpClientRequest.bodyText(HttpClientRequest.put("http://worker/todo"), "milk"))
      const found = yield* send(fetch, HttpClientRequest.get("http://worker/todo"))
      const missing = yield* send(fetch, HttpClientRequest.get("http://worker/other"))
      return { put: put.status, found: [found.status, text(found)], missing: [missing.status, text(missing)] }
    }).pipe(Effect.provide(testLayer(store))) as Effect.Effect<any>
  )

describe.each([
  ["VibeLang", Vibe.makeApi(), Vibe.default, VibeStack],
  ["Effect TypeScript", Original.makeApi, Original.default, OriginalStack]
])("%s", (_, makeApi, Worker, NotesStack) => {
  test("stores a note, serves it, and answers 404 for a missing key", async () => {
    const store = new Map<string, string>()
    expect(await run(makeApi, store)).toEqual({
      put: 204,
      found: [200, "milk"],
      missing: [404, "No note at other"]
    })
    expect(store.get("todo")).toBe("milk")
  })

  test("declares the Worker and the stack without deploying", () => {
    expect(Effect.isEffect(Worker)).toBe(true)
    expect(NotesStack.stackName).toBe("NotesStack")
  })
})
