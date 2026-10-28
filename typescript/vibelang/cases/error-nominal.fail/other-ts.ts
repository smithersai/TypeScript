// A TypeScript error class with NotFound's tag and fields.
import { Data } from "effect"

export class NotFound extends Data.TaggedError("NotFound")<{ readonly id: string }> {}
