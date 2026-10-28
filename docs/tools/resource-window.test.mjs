import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

test("the scope guide says using releases a JavaScript Disposable once, pending interruption included", () => {
  const text = readFileSync(new URL("../user/src/resource-management/030-scope.md", import.meta.url), "utf8")
  assert.match(text, /## Releasing JavaScript Disposables/)
  assert.match(text, /releases each resource exactly once/)
  assert.match(text, /interruption that is pending when acquisition finishes/)
  assert.match(text, /`Effect\.acquireRelease` or `Effect\.acquireDisposable` is released only by its release/)
  assert.doesNotMatch(text, /holder\.value/, "the plain-holder workaround is gone")
  const notes = readFileSync(new URL("../user/src/setup/release-notes.md", import.meta.url), "utf8")
  const current = notes.slice(notes.indexOf("## 0.0.11"), notes.indexOf("## 0.0.10"))
  assert.match(current, /Its release is now registered before the interruption can land/)
})
