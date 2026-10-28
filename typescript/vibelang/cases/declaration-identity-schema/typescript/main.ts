import * as Schema from "effect/Schema"

// alchemy: the trace a span carries.
/** The trace a span carries. */
export const TraceJson = Schema.Struct({ traceId: Schema.String })
export type TraceJson = typeof TraceJson.Type

// t3code: a user profile.
export const Profile = Schema.Struct({ name: Schema.String })
export type Profile = typeof Profile.Type

export const Code = Schema.Literals(["root_missing", "read_failed"])
export type Code = typeof Code.Type
