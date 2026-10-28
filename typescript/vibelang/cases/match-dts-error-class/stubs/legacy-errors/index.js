import { Data } from "effect"

export class Expired extends Data.TaggedError("Expired") {}
