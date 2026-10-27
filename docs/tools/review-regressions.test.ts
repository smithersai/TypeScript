import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.env.DOCS_REVIEW_ROOT || resolve(import.meta.dir, "../..")
const read = (path: string) => readFileSync(resolve(root, path), "utf8")

test("adjustable diagnostics identify EK9100 as an editor warning", () => {
  const configure = read("docs/user/src/getting-started/012-devtools.md")
    .split("## Configure compiler checks")[1].split("## TypeScript-style Effect code")[0]
  expect(configure).toMatch(/EK9100[^\n]*editor-only[^\n]*warns by default/)
})

import { extract } from "./check-snippets"

test("the HTTP client guide checks a request, JSON body read, and client layer together", () => {
  const blocks = extract(read("docs/user/src/platform/105-introduction.md"))
  expect(blocks.some(block => !block.fragment && !block.gap && !block.expected.length &&
    /HttpClient\.get\(/.test(block.source) && /response\.json\(\)/.test(block.source) &&
    /provide FetchHttpClient\.layer/.test(block.source))).toBe(true)
})
