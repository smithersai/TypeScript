import { Effect } from "effect"

// A program value with extra members, as Alchemy declares a Worker:
// Effect<Worker> & Named<...>.
export const labelled: Effect.Effect<number> & { readonly label: string } = Object.assign(
  Effect.sync(() => 41),
  { label: "answer" }
)
