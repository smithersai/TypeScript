// A synchronous spin that bun's per-test timeout cannot interrupt; the watchdog must name it.
import { expect, test } from "bun:test"

test("finishes first", () => {
  expect(1).toBe(1)
})

test("spins forever", () => {
  for (;;) {}
})
