import { Context, Effect } from "effect"

// foldkit: runtime/dispatch.
/** Effect service tag that provides message dispatching to the view layer. */
export class Dispatch extends Context.Service<
  Dispatch,
  {
    readonly dispatchAsync: (message: unknown) => Effect.Effect<void>
    readonly dispatchSync: (message: unknown) => void
  }
>()("@foldkit/Dispatch") {}

// alchemy: Domain/Telemetry, which imports Context from effect/Context; the
// migrate gate reads both import forms as one.
export class Correlation extends Context.Service<Correlation, { readonly id: string }>()("alchemy/Domain/Correlation") {}
