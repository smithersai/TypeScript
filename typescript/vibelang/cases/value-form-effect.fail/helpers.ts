// A trusted TypeScript function that returns the program it receives.
import { Effect } from "effect"

/** @vibelang trusted */
export function passThrough(p: Effect.Effect<number>): Effect.Effect<number> {
  return p
}
