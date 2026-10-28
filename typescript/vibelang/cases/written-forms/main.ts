import { Effect } from "effect"
import * as m from "./forms.vibe"

const cold = m.bump()
console.log("bump is cold", Effect.isEffect(cold))
console.log("ran", Effect.runSync(cold), Effect.runSync(m.bump()))
console.log("arrow", Effect.isEffect(m.arrow(1)), Effect.runSync(m.arrow(1)))
console.log("api", Effect.runSync(m.api.triple(2)))
console.log("plain", m.double(2), m.half(4), m.initial, JSON.stringify(m.halves), JSON.stringify(m.doubled), m.madeHalf, m.madeThird)
console.log("protocol", String(m.label), JSON.stringify({ l: m.label }))
console.log("main", JSON.stringify(Effect.runSync(m.main())))
