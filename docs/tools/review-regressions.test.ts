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
