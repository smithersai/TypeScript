import * as Cloudflare from "@alchemy.run/cloudflare"
import * as Alchemy from "alchemy"
import { Effect } from "effect"
import Api from "./api.ts"

export default Alchemy.Stack(
  "NotesStack",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const api = yield* Api
    return { url: api.url }
  })
)
