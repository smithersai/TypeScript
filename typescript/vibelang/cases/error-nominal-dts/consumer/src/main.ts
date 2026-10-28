// TypeScript code that uses the .vibe errors through their declarations: an
// error class with the same tag and fields is not one of them.
import { Data } from "effect"
import { describe, NotFound } from "../../out/main.js"

class Lookalike extends Data.TaggedError("NotFound")<{ readonly id: string }> {}

// @ts-expect-error a class with NotFound's tag and fields lacks its private member (TS2741)
export const forged: NotFound = new Lookalike({ id: "1" })

export const described = describe(new NotFound({ id: "7" }))
