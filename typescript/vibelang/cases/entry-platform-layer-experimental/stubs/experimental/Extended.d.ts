// A service whose type extends Effect's FileSystem under a key of its own,
// as the first 0.0.11 candidate declared Experimental.FileSystem: Effect's
// types let a layer of Effect's FileSystem pass for it, but at run time
// only a layer of its own key provides it.
import type * as Context from "effect/Context"
import type { FileSystem } from "effect/FileSystem"

export interface Extended extends FileSystem {
  readonly extended: true
}

export declare const Extended: Context.Service<Extended, Extended>
