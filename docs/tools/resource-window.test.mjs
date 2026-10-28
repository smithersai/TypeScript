import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

test("the scope guide says using releases a JavaScript Disposable once, pending interruption included", () => {
  const text = readFileSync(new URL("../user/src/resource-management/030-scope.md", import.meta.url), "utf8")
  assert.match(text, /## Releasing JavaScript Disposables/)
  assert.match(text, /releases each resource exactly once/)
  assert.match(text, /interruption that is pending when the initializer gives its value/)
  assert.match(text, /`Effect\.acquireRelease` or `Effect\.acquireDisposable` is released only by its release/)
  assert.doesNotMatch(text, /holder\.value/, "the plain-holder workaround is gone")
  const notes = readFileSync(new URL("../user/src/setup/release-notes.md", import.meta.url), "utf8")
  const current = notes.slice(notes.indexOf("## 0.0.11"), notes.indexOf("## 0.0.10"))
  // using adds no mask (D490), so an interruption pending in the initializer's own
  // mask is delivered as that mask ends, as Effect delivers it: a known limitation.
  assert.match(current, /delivered as that mask ends/)
  assert.doesNotMatch(current, /Its release is now registered before the interruption can land/)
})
