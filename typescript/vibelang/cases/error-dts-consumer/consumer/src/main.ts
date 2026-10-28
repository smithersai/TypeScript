// TypeScript code that uses the .vibe errors through their declarations, as
// it would Effect TypeScript's: an error class with the same tag and fields
// is assignable to NotFound's type (D501), but it is not a NotFound.
import { Data } from "effect"
import { describe, NotFound } from "../../out/main.js"

class Lookalike extends Data.TaggedError("NotFound")<{ readonly id: string }> {}

export const forged: NotFound = new Lookalike({ id: "1" })
export const forgedIsNotFound = forged instanceof NotFound

export const described = describe(new NotFound({ id: "7" }))
