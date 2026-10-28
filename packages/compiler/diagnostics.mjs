// Internal loader diagnostic selection. Global configuration errors still fail
// every load: a config is not a listed program source. An inline module shares its containing source's diagnostics.
import { realpathSync } from "node:fs"

const realpath = (path) => {
  try { return realpathSync(path) } catch { return path }
}

export function diagnosticsForFile(diagnostics, file, files) {
  const source = realpath(/^(.+\.vibe)\.[^./\\]+\.js$/.exec(file)?.[1] ?? file)
  return diagnostics.filter((diagnostic) => !diagnostic.file || !files.includes(diagnostic.file) || realpath(diagnostic.file) === source)
}
