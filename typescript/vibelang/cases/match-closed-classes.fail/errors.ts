// A TypeScript error class: it extends effect's YieldableError, so its arm
// covers it (D501).
import { Data } from "effect"

export class Missing extends Data.TaggedError("Missing")<{ readonly path: string }> {}
