// Token counts with the repository's own tool, docs/tools/token-counts.ts
// (o200k_base, js-tiktoken as docs/tools/package.json pins it), so a run's
// numbers match the ones the docs publish.
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { must, quote } from "./util.mjs"

export const vibelangRoot = fileURLToPath(new URL("../../../../", import.meta.url))
export const tokenTool = join(vibelangRoot, "docs/tools/token-counts.ts")

/** Parses the tool's `--files` output: one `count<TAB>path` line per file. */
export function parseTokenCounts(output) {
  const counts = {}
  for (const line of output.split("\n")) {
    const m = /^(\d+)\t(.+)$/.exec(line)
    if (m) counts[m[2]] = Number(m[1])
  }
  return counts
}

/** The o200k token count of each absolute path. */
export async function countTokens(paths) {
  const counts = {}
  for (let i = 0; i < paths.length; i += 100) {
    const chunk = paths.slice(i, i + 100)
    const { stdout } = await must(`bun ${quote(tokenTool)} --files ${chunk.map(quote).join(" ")}`)
    Object.assign(counts, parseTokenCounts(stdout))
  }
  for (const path of paths) if (!(path in counts)) throw new Error(`token-counts printed no count for ${path}`)
  return counts
}
