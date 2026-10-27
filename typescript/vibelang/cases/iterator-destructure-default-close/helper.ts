export const events: string[] = []
/** @vibelang trusted */
export function values(): Iterable<number | undefined> {
 return (function* () { try { events.push("open"); yield undefined } finally { events.push("close") } })()
}
