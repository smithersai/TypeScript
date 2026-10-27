import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import { Extended } from "../Extended.js"
import { Process } from "../Process.js"

// A Process whose pid, and an Extended whose readFileString, say the
// experimental bundle provided them.
export const layer = Layer.mergeAll(
  Layer.succeed(Process, { pid: Effect.succeed(42) }),
  Layer.succeed(Extended, FileSystem.makeNoop({ readFileString: (file) => Effect.succeed(`${file} read through the experimental NodeServices.layer`) }))
)
