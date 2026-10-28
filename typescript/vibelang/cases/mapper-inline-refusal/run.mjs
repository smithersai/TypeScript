import { Effect } from "effect"
import { main } from "./out/main.js"
console.log(Effect.runSync(main()))
