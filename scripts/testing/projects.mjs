// Serializable, bounded projects shared by bundler and (later) Vite properties.
// D364/D365/D403 (Chapter 26, Modules): imports, inline modules and evaluation order.
export function projectArbitrary(fc) {
  return fc.record({
    modules: fc.array(fc.record({
      typescript: fc.boolean(), inline: fc.boolean(),
      value: fc.integer({ min: -9, max: 9 }),
      text: fc.constantFrom("plain", "café", "雪", "😀"),
      padding: fc.integer({ min: 0, max: 2 })
    }), { minLength: 1, maxLength: 4 }),
    directory: fc.constantFrom("src", "src/space dir", "src/雪"),
    dotted: fc.boolean(), query: fc.constantFrom("", "?v=1", "?v=雪"),
    edit: fc.integer({ min: 1, max: 9 }),
    options: fc.boolean()
  })
}

export function projectFiles(input, edited = false, invalid = false) {
  // n0 is always VibeLang; other nodes may be TypeScript dependencies.
  const names = input.modules.map((node, i) => `n${i}.${i && node.typescript ? "ts" : "vibe"}`)
  const entry = `${input.directory === "src" ? "." : "./" + input.directory.slice(4)}/${names[0]}`
  const files = {
    "package.json": '{"private":true,"type":"module"}\n',
    "tsconfig.json": JSON.stringify({ compilerOptions: {
      target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext",
      strict: true, skipLibCheck: true, types: [], lib: ["ES2022", "DOM"],
      rootDir: ".", outDir: "dist", noEmitOnError: true,
      rewriteRelativeImportExtensions: true
    }, include: ["src/**/*"] }, null, 2) + "\n",
    "src/main.ts": `import { result } from ${JSON.stringify(entry)}\nconsole.log(JSON.stringify(result))\n`
  }
  const probes = []
  let expected
  for (let i = names.length - 1; i >= 0; i--) {
    const node = input.modules[i], file = `${input.directory}/${names[i]}`
    const marker = `B1_TOKEN_${i}`, indent = node.inline && file.endsWith(".vibe") ? "  " : ""
    const value = node.value + (edited && i === names.length - 1 ? input.edit : 0)
    const imports = i + 1 < names.length
      ? `${indent}import { result as child } from "./${input.dotted ? "./" : ""}${names[i + 1]}"\n` : ""
    // An astral character before the executable marker exercises UTF-16 columns.
    const text = "😀" + node.text
    const declaration = `${indent}export const result: { text: string; value: number; trace: string[] } = { text: ${JSON.stringify(text)}, value: ${value}${imports ? " + child.value" : ""}, trace: [${imports ? "...child.trace, " : ""}${JSON.stringify(marker)}] }\n`
    let source = "\n".repeat(node.padding)
    source += indent
      ? `module text {\n${imports}${declaration}}\nimport { result } from text\nexport { result }\n`
      : imports + declaration
    if (invalid && i === 0) source += 'export const broken: number = "wrong"\n'
    files[file] = source
    const offset = source.indexOf(JSON.stringify(marker))
    const before = source.slice(0, offset).split("\n")
    if (file.endsWith(".vibe")) probes.push({ file, marker, line: before.length - 1, column: before.at(-1).length })
    expected = { text, value: value + (expected?.value ?? 0), trace: [...(expected?.trace ?? []), marker] }
  }
  return { files, probes, expected }
}

export function projectArtifacts(input) {
  return Object.fromEntries([false, true].flatMap(edited =>
    Object.entries(projectFiles(input, edited).files).map(([file, source]) => [`${edited ? "edited" : "initial"}/${file}`, source])))
}
