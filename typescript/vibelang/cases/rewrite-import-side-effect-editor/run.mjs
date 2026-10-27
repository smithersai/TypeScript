import { compareRewrite } from "../../rewrite-preservation.mjs"
await compareRewrite(import.meta.url, '["adapter"] 1\n', { mode: "editor", editorClass: "Gone", present: ["error Gone"] })
