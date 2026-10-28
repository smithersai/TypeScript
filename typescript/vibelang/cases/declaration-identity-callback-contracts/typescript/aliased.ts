import { Effect as Eff } from "effect"

export function plusOne<E = never, R = never>(f: () => Eff.Effect<number, E, R>): Eff.Effect<number, E, R> {
  return Eff.map(f(), (n) => n + 1)
}
