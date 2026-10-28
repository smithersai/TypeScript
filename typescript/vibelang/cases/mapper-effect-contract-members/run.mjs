import { Effect } from "effect"
import { f } from "./out/main.js"
console.log(Effect.runSync(f(1)))
