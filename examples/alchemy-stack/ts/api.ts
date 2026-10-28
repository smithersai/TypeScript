import * as Cloudflare from "@alchemy.run/cloudflare"
import { Data, Effect } from "effect"
import { HttpServerRequest, HttpServerResponse } from "effect/http"

// An R2 bucket of notes, keyed by the request path.
export const Notes = Cloudflare.R2.Bucket("Notes", { forceDestroy: true })

export class MissingNote extends Data.TaggedError("MissingNote")<{ readonly key: string }> {}

// The Worker's init: binds the bucket, then returns the request handler.
export const makeApi = Effect.gen(function* () {
  const bucket = yield* Cloudflare.R2.ReadWriteBucket(Notes)

  const read = (key: string) =>
    Effect.gen(function* () {
      const note = yield* bucket.get(key)
      if (note === null) return yield* Effect.fail(new MissingNote({ key }))
      return yield* note.text()
    })

  return {
    fetch: Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const key = new URL(request.url, "http://worker").pathname.slice(1)
      if (request.method === "PUT") {
        yield* bucket.put(key, yield* request.text)
        return HttpServerResponse.empty({ status: 204 })
      }
      return HttpServerResponse.text(yield* read(key))
    }).pipe(
      Effect.catchTags({
        MissingNote: error => Effect.succeed(HttpServerResponse.text(`No note at ${error.key}`, { status: 404 })),
        R2Error: () => Effect.succeed(HttpServerResponse.text("Storage failed", { status: 502 }))
      })
    )
  }
})

export default Cloudflare.Worker(
  "Api",
  { main: import.meta.url },
  makeApi.pipe(Effect.provide(Cloudflare.R2.ReadWriteBucketBinding))
)
