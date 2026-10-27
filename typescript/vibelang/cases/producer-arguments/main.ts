import { Effect, Stream } from "effect"
import { echo, expression } from "./producer.vibe"

const collect = (stream: Stream.Stream<string>) => Effect.runSync(Stream.runCollect(stream))
const stream = echo("original", 2)
console.log(JSON.stringify([collect(stream), collect(stream)]))
console.log(JSON.stringify(collect(expression("expression"))))
