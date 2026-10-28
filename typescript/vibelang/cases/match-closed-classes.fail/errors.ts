// A TypeScript error class: code anywhere may make a value of its type that
// is not an instance, so its arm covers nothing.
import { Data } from "effect"

export class Missing extends Data.TaggedError("Missing")<{ readonly path: string }> {}
