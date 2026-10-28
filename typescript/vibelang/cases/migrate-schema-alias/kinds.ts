// vibelang --fix writes a schema constant and the type alias just before it
// as one schema alias (EK4841, D474). The migration renames this file to
// kinds.vibe; migrate-schema-alias-fixed holds what --fix then writes, which
// main.ts runs with the same result. The rule's fixes alone keep the
// declarations TypeScript emits (expected/kinds.d.ts).
import { Schema } from "effect"

// Literals.
export type Kind = typeof Kind.Type
export const Kind = Schema.Literals(["persistent", "incognito"])

// A union of other schemas.
export type Id = typeof Id.Type
export const Id = Schema.Union([Schema.String, Schema.Number])

// An array.
export type Tags = typeof Tags.Type
export const Tags = Schema.Array(Schema.String)

// Written before its type, the constant keeps its form: a schema alias's
// declaration file lists the type first, which would reorder this module's
// declarations.
export const Mode = Schema.Literals(["light", "dark"])
export type Mode = typeof Mode.Type

// No type writes a transformation.
export type Name = typeof Name.Type
export const Name = Schema.NullOr(Schema.String)
