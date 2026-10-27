import { compareRewrite } from "../../rewrite-preservation.mjs"
await compareRewrite(import.meta.url, "[\"adapter\"] 1\n", { present: ["error Gone", "service Extra"] })
