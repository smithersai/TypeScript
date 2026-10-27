export const events: string[] = []
/** @vibelang trusted */
export function pairs(): Iterable<[number | undefined]> {
 return (function* () { try { events.push("open"); yield [undefined] as [undefined] } finally { events.push("close") } })()
}
