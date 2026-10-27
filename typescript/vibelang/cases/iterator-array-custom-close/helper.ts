export const events: string[] = []
/** @vibelang trusted */
export function customArray(): number[] {
 const arr = [1]
 arr[Symbol.iterator] = function* () {
  try { events.push("open"); yield 1; return undefined }
  finally { events.push("close") }
 }
 return arr
}
class CustomArray extends Array<number> {
  *[Symbol.iterator](): ArrayIterator<number> {
    try { events.push("open"); yield 1 }
    finally { events.push("close") }
  }
}
/** @vibelang trusted */
export function subclassArray(): number[] { return new CustomArray(1) }
/** @vibelang trusted */
export function proxyArray(): number[] {
  return new Proxy([1], {
    get(target, key, receiver) {
      if (key === Symbol.iterator) return function*() {
        try { events.push("open"); yield 1 }
        finally { events.push("close") }
      }
      return Reflect.get(target, key, receiver)
    }
  })
}
