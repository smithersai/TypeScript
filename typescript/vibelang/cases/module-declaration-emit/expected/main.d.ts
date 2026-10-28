import { Effect } from "effect";
import type { Shape } from "./main.vibe.shapes.js";
import "./main.vibe.setup.js";
export { clean as tidy } from "./main.vibe.text.js";
export * from "./main.vibe.extras.js";
export declare function describe(shape: Shape): Effect.Effect<string>;
export declare function main(): Effect.Effect<void, never, never>;
