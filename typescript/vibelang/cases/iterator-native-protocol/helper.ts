export const events: string[] = []
/** @vibelang trusted */
export function values(name: string, entries: any[]): Iterable<any> {
  return {
    *[Symbol.iterator]() {
      events.push(name + ":open")
      try {
        for (const entry of entries) { events.push(name + ":next"); yield entry }
        events.push(name + ":done")
      } finally { events.push(name + ":close") }
    }
  }
}
/** @vibelang trusted */
export function reference(): string[][] {
  const results: string[][] = []
  const fail = (): number => { throw "boom" }
  events.length = 0
  try {
    const { items: [[n = fail()]] } = { items: values("outer", [values("inner", [undefined])]) }
    events.push("unreachable:" + n)
  } catch { events.push("caught") }
  results.push(events.splice(0))
  let loopTarget = [0]
  try { for (loopTarget[fail()] of values("loop-target", [1])) events.push("unreachable") }
  catch { events.push("caught") }
  results.push(events.splice(0))
  let target = [0]
  try { [target[fail()]] = values("target", [1]); events.push("unreachable") }
  catch { events.push("caught") }
  results.push(events.splice(0))
  let restTarget: number[][] = []
  try { [...restTarget[fail()]] = values("rest", [1, 2]); events.push("unreachable") }
  catch { events.push("caught") }
  results.push(events.splice(0))
  const [, n = 7, ...rest] = values("elision", [1, undefined, 3, 4])
  events.push(String(n) + ":" + rest.join(","))
  results.push(events.splice(0))
  return results
}
