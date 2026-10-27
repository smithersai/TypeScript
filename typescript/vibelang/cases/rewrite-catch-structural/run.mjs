import { compareRewrite } from "../../rewrite-preservation.mjs"
await compareRewrite(import.meta.url, "7\n", {})
