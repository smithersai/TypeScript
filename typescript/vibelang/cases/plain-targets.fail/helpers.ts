// Trusted TypeScript functions that call the plain functions they receive.
/** @vibelang trusted */
export function runAll(fs: ReadonlyArray<() => unknown>): void {
  for (const f of fs) f()
}

/** @vibelang trusted */
export function register(h: { onSave(doc: string): void }): void {
  h.onSave("doc")
}

/** @vibelang trusted */
export function resetAll(rs: ReadonlyArray<{ reset(): void }>): void {
  for (const r of rs) r.reset()
}
