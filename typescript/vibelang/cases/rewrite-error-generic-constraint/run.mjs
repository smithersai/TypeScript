import { compareRewrite } from "../../rewrite-preservation.mjs"
await compareRewrite(import.meta.url, "ok\n", {"mode": "editor", "present": ["error Bad<T extends string>"]})
