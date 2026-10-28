// vibelang --fix imports Effect's modules that JavaScript's globals name
// under other names (EK4842, D475). The migration renames this file to
// util.vibe; migrate-global-import-fixed holds what --fix then writes, which
// main.ts runs with the same result. The rule's fixes alone keep the
// declarations TypeScript emits (expected/util.d.ts).
import { Array, Number, String } from "effect"

export function firstTwo(values: ReadonlyArray<number>): ReadonlyArray<number> {
  return Array.take(values, 2)
}

export function total(values: ReadonlyArray<number>): number {
  return Number.sumAll(values)
}

export const shout = (text: string): string => String.toUpperCase(text)

// Array<number> is the global's type: the module declares no type Array.
export function pair(a: number): Array<number> {
  return [a, a]
}
