import { compareRewrite } from "../../rewrite-preservation.mjs"
await compareRewrite(import.meta.url, "1 2 b,a\n", {"mode": "format"})
