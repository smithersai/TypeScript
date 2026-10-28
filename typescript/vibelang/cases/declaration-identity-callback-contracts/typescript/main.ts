import { Effect } from "effect"

export function mapAll<A, B, E = never, R = never>(items: ReadonlyArray<A>, f: (a: A) => Effect.Effect<B, E, R>): Effect.Effect<B[], E, R> {
  return Effect.forEach(items, f)
}

export function twice<E = never, R = never>(f: () => Effect.Effect<number, E, R>): Effect.Effect<number, E, R> {
  return Effect.zipWith(f(), f(), (a, b) => a + b)
}
