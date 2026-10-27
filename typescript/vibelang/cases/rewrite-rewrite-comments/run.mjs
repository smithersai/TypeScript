import { compareRewrite } from "../../rewrite-preservation.mjs"
await compareRewrite(import.meta.url, "7 1\n4 3\n5\n", {"present": ["/* field explanation */", "/* keep this explanation */", "// value explanation", "/* wrapper explanation */", "// failure explanation"]})
