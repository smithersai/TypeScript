// Imports the file as a TypeScript or JavaScript consumer would.
import assert from "node:assert/strict"
import * as main from "./out/main.js"

assert.equal(main.current, 0)
assert.equal(main.bump(), 1)
assert.equal(main.current, 1)
assert.equal(main.counterModule.count, 1)
assert.equal(Object.prototype.toString.call(main.counterModule), "[object Module]")
assert.equal(main.add(5), 15)
assert.equal(main.total, 15)
console.log("re-exports are live")
