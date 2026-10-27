import { Effect } from "effect"
import { Box } from "./box.vibe"

const box = new Box()
const run = (name: string, program: () => Effect.Effect<number>) => {
  try {
    console.log(name, Effect.runSync(program()))
  } catch (error) {
    console.log(name, String(error))
  }
}
run("default", () => box.fromDefault()())
run("extends", () => box.fromExtends()())
run("method", () => box.method())
