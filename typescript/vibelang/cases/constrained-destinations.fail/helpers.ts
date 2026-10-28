// Trusted TypeScript wrappers whose callback type is a constrained type
// parameter or Function, as lodash's once and React's useCallback declare.
/** @vibelang trusted */
export function once<T extends (...args: any) => any>(func: T): T {
  let done = false
  let result: unknown
  return ((...args: Array<unknown>) => {
    if (!done) {
      done = true
      result = func(...args)
    }
    return result
  }) as unknown as T
}

/** @vibelang trusted */
export function useCallback<T extends Function>(callback: T, _deps: ReadonlyArray<unknown>): T {
  return callback
}

/** Calls f twice, as a TypeScript caller would, and returns what it returned last.
 * @vibelang trusted */
export function callTwice(f: Function): unknown {
  f()
  return typeof f()
}
