// Runs process-scenarios.ts under Node.js, with Effect's Node.js services and
// the ExperimentalNodeProcess layer, and prints what it observed.
import { NodeServices } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { ExperimentalNodeProcess } from "vibelang-runtime/experimental/platform-node"
import { observe } from "./process-scenarios.ts"

const observed = await Effect.runPromise(observe.pipe(Effect.provide(Layer.merge(NodeServices.layer, ExperimentalNodeProcess.layer))))
console.log(JSON.stringify(observed))
