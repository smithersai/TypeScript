// Trusted TypeScript helpers that report the form of the callback they get.
import { Effect } from "effect"

/**
 * Calls f once and reports whether it returned a value or a program, which
 * it never runs. Its parameter accepts both forms.
 *
 * @vibelang trusted
 */
export function once(f: () => number | Effect.Effect<number>): string {
  const r = f()
  return Effect.isEffect(r) ? "effect" : typeof r
}

/**
 * Calls a plain callback.
 *
 * @vibelang trusted
 */
export function takesPlain(f: (x: number) => number): number {
  return f(1)
}
