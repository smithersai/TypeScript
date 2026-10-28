// vibelang --fix writes a schema constant and the type alias just after it
// as one schema alias (EK4841, D474, D501). The migration renames this file to
// kinds.vibe; migrate-schema-alias-fixed holds what --fix then writes, which
// main.ts runs with the same result. The rule's fixes alone keep the
// declarations TypeScript emits (expected/kinds.d.ts).
import { Schema } from "effect"

// Literals.
export const Kind = Schema.Literals(["persistent", "incognito"])
export type Kind = typeof Kind.Type

// A union of other schemas.
export const Id = Schema.Union([Schema.String, Schema.Number])
export type Id = typeof Id.Type

// An array.
export const Tags = Schema.Array(Schema.String)
export type Tags = typeof Tags.Type

// Written after its type, the constant keeps its form: a schema alias's
// declaration file lists the constant first (D501), which would reorder this
// module's declarations.
export type Mode = typeof Mode.Type
export const Mode = Schema.Literals(["light", "dark"])

// No type writes a transformation.
export type Name = typeof Name.Type
export const Name = Schema.NullOr(Schema.String)
