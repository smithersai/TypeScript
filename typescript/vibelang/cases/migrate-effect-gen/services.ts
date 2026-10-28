import { Context, Data, Effect } from "effect"

export class Gone extends Data.TaggedError("Gone")<{ readonly id: number }> {}

export class Users extends Context.Service<Users, { readonly find: (id: string) => Effect.Effect<string> }>()("app/Users") {}
