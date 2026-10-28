// A trusted TypeScript function that calls a plain callback and drops its result.
/** @vibelang trusted */
export function each(xs: ReadonlyArray<number>, f: (x: number) => unknown): void {
  for (const x of xs) f(x)
}
