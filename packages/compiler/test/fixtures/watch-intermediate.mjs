// Fault injection for the watch assertion regression, never a compiler wrapper.
// Deliver a completed empty build exactly while the test writes its broken
// revision. No timer is needed: the test must correlate the next completion.
import fs from "node:fs"
import childProcess from "node:child_process"
import { syncBuiltinESMExports } from "node:module"

const spawn = childProcess.spawn
const writeFile = fs.writeFileSync
const rename = fs.renameSync
let watcher
let injected = false
childProcess.spawn = function (...args) {
  const child = spawn.apply(this, args)
  if (args[1]?.includes("-w")) watcher = child
  return child
}
const intermediate = file => {
  if (!watcher || injected || !String(file).endsWith("/main.vibe")) return
  if (!fs.readFileSync(file, "utf8").includes("const broken: number")) return
  injected = true
  watcher.stdout.emit("data", Buffer.from("\nFound 0 errors. Watching for file changes.\n"))
}
fs.writeFileSync = function (file, ...args) {
  const result = writeFile.call(this, file, ...args)
  intermediate(file)
  return result
}
fs.renameSync = function (from, to) {
  const result = rename.call(this, from, to)
  intermediate(to)
  return result
}
syncBuiltinESMExports()
