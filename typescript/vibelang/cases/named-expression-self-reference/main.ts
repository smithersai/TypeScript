import { Effect, Stream } from "effect"
import { deep, identity, named, retried, viaDefault } from "./self.vibe"

console.log("retried", Effect.runSync(retried(2)))
console.log("deep", Effect.runSync(deep(20000)))
const self = Effect.runSync(identity())
console.log("identity", self === identity, Effect.isEffect(self()))
console.log("default", Effect.runSync(viaDefault(2)))
console.log("producer", JSON.stringify(Effect.runSync(Stream.runCollect(named("a")))))
