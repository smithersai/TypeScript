import { compareRewrite } from "../../rewrite-preservation.mjs"
await compareRewrite(import.meta.url, "ok\n", {"absent": ["Effect.Effect<"]})
