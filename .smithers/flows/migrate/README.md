# The migrate flow: an Effect TypeScript codebase to VibeLang

The migrate flow moves an existing Effect TypeScript codebase to idiomatic VibeLang the way a codemod would: in small planned batches, mechanically wherever a rule can do the work, with an agent only where none can, and gated on the target's own tests and public API. Every run also produces the list of what the codemod could not do and what VibeLang got wrong, which is how the next run gets better.

```text
setup ──▶ plan ──▶ for each batch: codemod ──▶ compile ──▶ repair ──▶ verify ──▶ record ──▶ report
(no model) (agent)                 (no model)  (no model)  (agent)    (no model) (no model)  (no model)
```

| Step | Model | What it does | Writes |
| --- | --- | --- | --- |
| setup | none | Installs and runs the target's tests as they are; sets VibeLang up (dependencies, Effect pinned to the runtime's version, `tsc` to `vibelang` in scripts, the `vibelang-vite` plugin, `rewriteRelativeImportExtensions`); installs and runs the tests again as the baseline; checks each package with `vibelang`; emits its declarations; inventories every source file; commits | `setup.json`, `baseline/`, `inventory.json` |
| plan | one agent call | Orders the Effect files into small batches, leaves and tested modules first, each with a reason; the answer is validated before anything reads it | `plan.prompt.md`, `plan.draft.json`, `plan.json` |
| codemod | none | Marks each member TypeScript declares writable `mutable`, which keeps it writable in `.vibe` (D134), renames the batch to `.vibe`, rewrites imports by VibeLang's rules, runs `vibelang --fix` until it fixes nothing, and records each rewrite it applied or refused | `batches/NN/codemod.json` |
| compile | none | `vibelang --noEmit`: the batch's diagnostics and any error new against the baseline | `batches/NN/compile.json` |
| repair | agent | Fixes what is left and finishes the idiomatic rewrite, with `context.md` as its system prompt; records codemod gaps, VibeLang issues and idiom lessons; returns a file it cannot migrate to `.ts` | `batches/NN/repair.prompt.md`, `repair.json`, `issues.jsonl` |
| verify | none | The tests pass with no new failure against the baseline; the emitted declarations are identical to the baseline's; the batch has no error, no EK48xx and no EK4402 | `batches/NN/verify.json` |
| record | none | Commits the batch with jj, naming its files, with o200k token counts before and after | `batches/NN/record.json` |
| report | none | Batches, tests, declaration identity, tokens, codemod gaps, issues and idiom lessons | `report.md`, `report.json` |

Each step reads and writes the run directory, so a step that already recorded its result returns it, and a stopped run resumes where it stopped.

## Run it

Every batch lands on a jj bookmark, `vibe` unless `--bookmark` names another: setup starts it on the default branch (`trunk()`, or `--base <branch>`, such as `dev`), or continues an earlier run's `vibe`, and each recorded batch is one commit on top of the last. The flow never pushes. After each run, the orchestrator pushes `vibe` to the library's fork and opens a pull request from it there, so the migration's diff is reviewable.

Both ways need a VibeLang toolchain: a published version (`--vibelang-version 0.0.11`), or a staged build of a checkout, which runs the compiler on main before it is published:

```sh
sh scripts/build-vibelang.sh && (cd packages/runtime && bun install && bun run build) && (cd docs/tools && bun install)
node .smithers/flows/migrate/step.mjs toolchain --vibelang . --out <toolchain>
```

The toolchain holds the native compiler, npm tarballs of `vibelang` (with that compiler), `vibelang-runtime` and `vibelang-vite`, and the TypeScript compiler API that reads declarations. Setup copies the tarballs into `.vibelang-toolchain/` at the target's root, adds that directory to the target's `.gitignore`, and names them relatively from each package (`file:../../.vibelang-toolchain/vibelang-0.0.11.tgz`), so no commit names a path on the build host. Every commit the flow makes first checks the lines it adds for this machine's absolute paths and refuses them. The target must be a jj repository or a Git checkout, which setup makes a colocated jj repository.

### Registry versions

Once VibeLang publishes the version a migration needs, use the registry instead of a staged toolchain: run setup with `--vibelang-version <version>` in place of `--toolchain <dir>`. Setup then writes exact versions (`"vibelang": "0.0.12"`) and makes no `.vibelang-toolchain/`. Anyone can install the result, and the fork's pull request no longer depends on the tarballs.

To switch a target that a staged toolchain set up, start a new run on it with `--vibelang-version`. Setup continues on the `vibe` bookmark. It replaces the three `file:` specifiers with the version, deletes `.vibelang-toolchain/` and its `.gitignore` line, reinstalls, records a new baseline, and commits the switch on top. The batches already on `vibe` stay as they are.

### Step by step

Each command prints its result and the next step. A person, or an agent session driving the run, answers the two agent steps:

```sh
step="node .smithers/flows/migrate/step.mjs"
$step setup --run <run> --target <repo> --package packages/core --test "pnpm exec vitest run" --test-cwd packages/core --toolchain <toolchain>
$step plan --run <run>                        # writes plan.prompt.md and a deterministic draft
$step plan --run <run> --accept <answer.json> # validates and records the plan
$step codemod --run <run>
$step compile --run <run>
$step repair --run <run>                      # writes batches/NN/repair.prompt.md; do the repair it asks for,
                                              # checking with compile --no-record and verify as you go
$step repair --run <run> --done               # checks issues.jsonl and records the repair
$step verify --run <run>                      # a failure sends the batch back to repair
$step record --run <run>
$step report --run <run>
$step next --run <run>                        # what to run next
```

`--agent "<command>"` on `plan` or `repair` runs an agent instead: the command gets the prompt on stdin and its path in `MIGRATE_PROMPT`, runs in the target's root, and for `plan` writes its JSON answer to `MIGRATE_OUTPUT`. Any coding agent with a non-interactive mode fits; the flow has no code for any particular one. `revert --file <path.vibe> --reason "<text>"` returns one file of the current batch to its `.ts` source, and points every import the codemod rewrote to `.vibe` back at the `.ts` file.

Setup adds the `vibelang-vite` plugin to the Vite or Vitest config the tests load. When the test command, or the package script it runs (`pnpm test`), names one with `--config`, such as a monorepo's shared `../../vite.config.ts`, setup wires that file, and the package that owns it gets `vibelang` and `vibelang-vite` as dev dependencies. Otherwise it wires each package's own config.

`setup` takes `--base` and `--bookmark` (above), `--package` and `--source` more than once, `--tsconfig` (default `tsconfig.json`, the project the tests check), `--dts-tsconfig` (default `tsconfig.build.json` when it exists: the project whose declarations are the public API), `--install`, `--no-wire` for a target that already has VibeLang, `--max-files` and `--max-lines` per batch (6 and 900), and `--allow-dirty`.

### As a Smithers flow

`flow.ts` declares the same steps as durable actions of `Flow.make("migrate", ...)`. One execution sets the run up and plans it the first time, then migrates the next batch and reports; the next execution migrates the batch after it. `run.ts` runs one execution on the in-memory engine:

```sh
MIGRATE_AGENT="<agent command>" bun .smithers/flows/migrate/run.ts --run <run> --target <repo> \
  --package packages/core --test "pnpm exec vitest run" --test-cwd packages/core --toolchain <toolchain>
```

The agent steps read `MIGRATE_AGENT` through Effect `Config`; without it, they fail with the prompt to answer, and the standalone steps take over from there. The agent is a command, not `@smthrs/agent`: a repair edits files and runs the target's compiler and tests in its repository on a build host, which a coding agent's non-interactive mode does today, and this repository's `.smithers` composes no model seat for `AgentAction`. A test supplies a scripted command.

## The idiom context

`context.md` is the repair agent's system prompt. `build-context.mjs` generates it, so it is never edited by hand:

- `rules.md`, this flow's own rules: the current call rule (a call runs where it stands; only a function literal defers it), every VibeLang form, wrapping Effect mindfully, platform access only through services, Effect's modules or `Experimental.*`, hatches only for real Promise and callback libraries, identical declarations, every test kept.
- The VibeLang skill, `packages/compiler/skills/vibelang/SKILL.md`.
- The convert flow's cheat sheet and worked examples (`../convert/`).
- The platform globals table, `docs/user/src/platform/platform-globals.md`.

```sh
node .smithers/flows/migrate/build-context.mjs           # write context.md
node .smithers/flows/migrate/build-context.mjs --check   # fail when it is stale
```

## Each run improves the next

A run's `issues.jsonl` is the input to the loop that improves the flow. The repair agent appends one entry per lesson; setup appends one when setting VibeLang up breaks a target test before any file moves, and still finishes, so no batch is blamed for it. A runner without per-test results, such as `bun test`, is compared by its exit status, and the issue names the logs from before and after.

| Entry | Where it goes |
| --- | --- |
| `codemod-gap`: a rewrite made by hand that a rule could make (`pattern`, `before`, `after`, `count`) | A `--fix` rule in the compiler: a quick fix for the diagnostic (`typescript/tsc/internal/vibelang/tsforms_*.go` or `lsrules_fixes.go`), its code in `tsFormFixCodes` when it is safe, and a case in `typescript/vibelang/cases/` with the before and after. The next run's codemod applies it. |
| `idiom`: a lesson the context did not teach (`lesson`, `before`, `after`) | One line in `rules.md` (or the skill, when it is about the language rather than migrating), then `node build-context.mjs`. |
| `issue`: a VibeLang bug or missing feature (`title`, `repro`, `expected`, `actual`, `files`) | A VibeLang issue with the reproduction, fixed with a test. The blocked files stay `.ts` until it is fixed; the next run's plan picks them up. |

`report.md` lists all three, with the rewrites `--fix` applied and refused, so a run's report says which rule to write next.

## Tests

```sh
node --test .smithers/flows/migrate/test/*.test.mjs
```

The deterministic steps are tested against fixtures: import parsing and rewriting, `--fix` output, diagnostics, the plan's draft and validation, the setup edits, test-report comparison, declaration canonicalization (it needs `bun install` in `packages/runtime`, whose TypeScript has the compiler API), the run's state machine, issue validation and the generated context.
