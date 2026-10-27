import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = process.env.DOCS_REVIEW_ROOT || resolve(import.meta.dir, "../..")
const read = (name: string) => readFileSync(resolve(root, "docs/user/src/setup/" + name + ".md"), "utf8")

for (const name of ["vue", "svelte"]) {
  test(name + " distinguishes plugin import rewriting from direct CLI compilation", () => {
    const config = read(name).split("## 2. Configure tsconfig.json")[1].split("## 3.")[0]
    expect(config).toMatch(/plugin[^\n]*automatically enables `rewriteRelativeImportExtensions`/)
    expect(config).not.toMatch(/`vite build` fails with TS509[67]/)
    expect(config).toContain("vibelang -b")
    if (name === "svelte") expect(config).toMatch(/vibelang -b[^\n]*TS5097/)
  })
  test(name + " shows the excluded test project diagnostic", () => {
    const config = read(name).split("## 2. Configure tsconfig.json")[1].split("## 3.")[0]
    const stem = name === "vue" ? "todos" : "cart"
    expect(config).toContain("vibelang: …/src/" + stem + ".test.vibe is not part of …/tsconfig.app.json. Add it to the tsconfig's include.")
    expect(config).not.toContain("ENOENT")
  })
}

test("Vue documents both unresolved VibeLang import locations alongside rewrite errors", () => {
  const build = read("vue").split("## 8. Type-check and build")[1].split("## Next")[0]
  expect(build).toMatch(/TS2307[^\n]*\.\/todos\.vibe[^\n]*runtime\.ts[^\n]*TodoBoard\.vue/)
  expect(build).toContain("TS2876")
})
