# VibeLang improvement proposals

Will decides each VibeLang language decision as a VIP, one at a time. The most fundamental decisions come first, and the most controversial come next. Each accepted VIP is recorded here with Will's words. Where an accepted VIP disagrees with the specification, the VIP wins until the specification is rewritten to match it. VIPs never contradict each other: a later VIP that changes an earlier one also updates it.

| VIP | Title | Status |
| --- | --- | --- |
| [1](0001-effect-and-async-functions.md) | `effect` and `async` functions | accepted 2026-10-28 |
| [2](0002-effect-blocks-and-do.md) | `effect { }` blocks, and `do { }` as TC39 defines it | accepted 2026-10-28 |
| [3](0003-effect-type-shorthand.md) | `A!E!R` is an alias for `Effect<A, E, R>` | accepted 2026-10-28 |
| [4](0004-throw.md) | `throw`, and calls that may throw | accepted 2026-10-28 |
| [5](0005-try-runs-effects.md) | `try` runs an Effect; `await` is only for Promises | accepted 2026-10-28 |
| [6](0006-effect-globals.md) | Effect's functions are globals | accepted 2026-10-28 |
| [7](0007-match.md) | `match` is TC39 pattern matching, plus a compile-time exhaustiveness check | accepted 2026-10-28 |
