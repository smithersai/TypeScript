import { expect, test } from "bun:test"
import { $errors, $trusted, Effect, Exit, trusted } from "vibelang-runtime"

class PortError extends Error { readonly kind = "port" }
class HostError extends Error { readonly kind = "host" }

test("trusted: one plain function that throws what impl throws and carries its classes (D514)", () => {
  const port = new PortError("port")
  for (const error of [port, new Error("unlisted"), "non-Error"]) {
    const call = trusted((): number => { throw error }, [PortError, HostError])
    expect(call[$errors]).toEqual([PortError, HostError])
    expect(() => call()).toThrow()
    // A VibeLang call converts the listed classes, as $trusted does.
    expect(Effect.runSyncExit($trusted(() => call(), call[$errors]))).toEqual(
      error === port ? Exit.fail(error) : Exit.die(error)
    )
  }
})

test("trusted: calls run at once, this-free, preserve parameters and return values", () => {
  let calls = 0
  const holder = { call: trusted(function (this: void, head: number, ...tail: string[]) {
    expect(this).toBeUndefined()
    calls++
    return { head, tail }
  }, []) }
  const detached = holder.call
  expect(detached(42, "a", "b")).toEqual({ head: 42, tail: ["a", "b"] })
  expect(calls).toBe(1)
  expect(holder.call(7)).toEqual({ head: 7, tail: [] })
  expect(calls).toBe(2)
  expect(["x", "yz"].map(trusted((s: string) => s.length, []))).toEqual([1, 2])
})
