import type { BunServices as PlatformServices } from "@effect/platform-bun/BunServices"
import type { Layer } from "effect/Layer"

export declare namespace ExperimentalBunServices {
  const layer: Layer<PlatformServices>
}
