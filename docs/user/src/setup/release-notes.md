# Release notes

VibeLang is v0, so a new version can change the language in breaking ways.
Before you update, read the notes for every version between yours and the new
one, and update `vibelang`, `vibelang-runtime`, and `vibelang-vite` together.


## 0.0.11

Update `vibelang`, `vibelang-runtime` and your bundler plugin together to
0.0.11. Keep exactly `effect@4.0.6`, matching `@effect/platform-*` and
`@effect/vitest` when used, and the `@effect/platform-node-shared` override
at 4.0.6. Effect's failure rules from 0.0.10 still apply.

### Upgrade from 0.0.10

This release changes platform access and name resolution in `.vibe`.
D310, D311, D312 and D313 are **provisional, pending the owner's review**.
Run `vibelang -p tsconfig.json --fix`, then check the remaining diagnostics
against [Platform globals](../platform/platform-globals.md).
The fixes keep a rewrite only when it adds no compiler error.

| Before | After and repair |
| --- | --- |
| `import { Path } from "effect"`; `Path.Path.join("a", "b")` | Every unambiguous Effect module is global; write `Path.join("a", "b")`. Existing imports still work. `--fix` removes redundant imports and shortens the module's same-named export. |
| The type `Option.Option<number>` | Write `Option<number>`; the long form remains valid. A module's own exports still win over its same-named export. |
| A DOM type named `Cache`, `Console`, `Crypto`, `FileSystem`, `Scheduler`, `Transferable` or `Worker` | The bare name now means Effect's same-named type. Export an alias such as `export type DomWorker = Worker` from a `.ts` file and import that type. To use the DOM constructor, put `globalThis.Worker` in a hatch or named TypeScript module. |
| `console.log("hello")`, or holding `const logger = console` | The call was already EK4402; holding the value is newly rejected. Use `Console.log("hello")`; the map lists the Effect service for each platform global. Node/web I/O globals are out of scope outside TypeScript escapes. |
| A value import such as `import { join } from "node:path"` | EK4402, even before a call. Use `Path.join`; for an uncovered API, import it in a named `module` block or a `.ts` file and call through a hatch. A type-only import remains allowed. |
| An entry that manually provides `NodeServices.layer` around `FileSystem.FileSystem.readFileString(path)` | It can start with `import "vibelang/platform/node"` and call `FileSystem.readFileString(path)`; the entry provides the required platform bundle. This spelling is provisional. Existing explicit providers keep working; no import is required for a main with no platform needs. |
| Early 0.0.11 experimental layer imports named `NodeServices`, `NodeCrypto` or `BrowserLocks` | Exports from `vibelang-runtime/experimental/platform-*` now start with `Experimental`: import `ExperimentalNodeServices`, `ExperimentalNodeCrypto` or `ExperimentalBrowserLocks`. Rename the other experimental layers the same way. Imports from Effect's `@effect/platform-*` packages keep their names. |
| Both `import "vibelang/platform/node"` and `import "vibelang/platform/bun"` in one file | EK3206 rejects conflicting imports. Keep one platform import per file; use a separate entry file for each host. Repeating the same platform is allowed. |
| A platform API in a hatch because Effect has no equivalent | Prefer the new `Experimental.FileSystem`, `Experimental.Crypto`, `Experimental.Process` or `Experimental.Locks` where covered. Their layers and platform limits are listed below; an uncovered API stays in TypeScript. |
| `interrupt` alone as a statement | EK4801: it previously ran nothing. Write `interrupt()` (the quick fix), likewise `yieldNow()` and other zero-argument program references. |
| `return x ?? throw c ? a : b` | EK1010: it previously parsed as `(x ?? throw c) ? a : b`, throwing only `c`. Write `return x ?? throw (c ? a : b)`. |
| `error Sub extends Base { path: string }` when Base's constructor takes a primitive or list | EK2118 at the declaration; before, construction usually failed later with TS2345. Write a constructor that calls `super` with the arguments Base expects. |
| `module { export const value = 1 }` | EK4408 replaces misleading platform/call errors. Name it: `module helpers { export const value = 1 }`. |
| A method with a plain return annotation whose body runs an Effect, such as `count(): number { sleep("1 millis"); return 42 }` | EK2003, as for a function. It previously compiled, declared `count(): number`, and returned an unrun Effect to callers that reached it through an interface or from TypeScript. Write its contract, `count(): number!!`, or remove the annotation. A method implementing a plain member such as `[Equal.symbol]` keeps EK4301. |
| An `await` binding such as `const await = 1` | Rejected in a VibeLang module; rename the binding. It previously compiled despite the reserved word. JavaScript `await` remains available inside TypeScript escapes. |

Direct platform calls such as `console.log` and `process.env.NAME` were
already EK4402 in 0.0.10; holding their values and importing Node values
are newly rejected. The trailing-throw example compiled with an inferred
return in 0.0.10 and is now EK1010; a restrictive return contract could
already reject it with EK2001. A nameless module already failed with less
useful diagnostics. The DOM type example, bare program statements,
primitive-base declaration, effectful method under a plain annotation and
`await` binding compiled then and are rejected now.

With npm:

```sh
npm install --save-exact vibelang-runtime@0.0.11 effect@4.0.6 @effect/platform-node@4.0.6
npm install --save-dev --save-exact vibelang@0.0.11 vibelang-vite@0.0.11 @effect/vitest@4.0.6
npm run build
npm test
```

With Bun:

```sh
bun add --exact vibelang-runtime@0.0.11 effect@4.0.6 @effect/platform-node@4.0.6
bun add -d --exact vibelang@0.0.11 vibelang-vite@0.0.11 @effect/vitest@4.0.6
bun run build
bun run test
```

Keep the existing override in `package.json`:

```json
{ "overrides": { "@effect/platform-node-shared": "4.0.6" } }
```

Projects using another bundler update `vibelang-unplugin` to 0.0.11
instead of installing the Vite plugin. See the 0.0.10 notes below for the
Effect 4.0.6 defect-precedence and interruption migration.


### Bugs fixed since 0.0.10

#### Compiler and diagnostics

- A non-tail `resume` could receive a value outside its type and crash after only EK2119 warned. EK2119 is now an error; write a success type covering the handler's answers.
- Providers now remove only services supplied on every path. Invalid providers report EK3207; unions, optional tuple elements and array spreads keep requirements they cannot guarantee, and service defaults are checked against their shape and member contracts.
- The process.exit and process.exitCode replacements did not state their exit statuses. The diagnostic and table now say to return for 0, fail for 1 or interrupt for 130.
- Experimental FileSystem and Crypto requirements could be mistaken for Effect's services and fail with a missing service at runtime. Their keys now have distinct identities, and the entry selects their experimental layer.
- A local method named runSync could suppress main, while an aliased runner could go unrecognized. Runner detection now follows the resolved function.
- A browser entry could import Node's runner and fail to load in a browser. It now uses BrowserRuntime and imports no Node modules; the page starts main explicitly.
- Conflicting platform imports silently chose one platform. EK3206 now rejects a second, different platform import; keep one per file.
- An entry using standard and experimental services could build the platform twice. It now provides one shared platform layer.
- EK3205 could name a missing platform service without its provider. It now names the layer that supplies each service.
- Class and object methods with plain return annotations could hide an unrun Effect. They now report EK2003, with the contract repair in [Upgrade from 0.0.10](#upgrade-from-0010).
- Reading Path.sep produced an unexplained missing-property error. EK4503 now points to Path().sep on the service implementation.
- Errors on shared prelude and global names could leave their meaning unclear. Notes now identify the selected module or global and explain how to reach the other.
- A misspelled name could suggest a platform global that EK4402 bans. Suggestions now omit banned globals outside TypeScript escapes, and missing Process or Locks names point to Experimental.
- Subclasses of fieldless error families could reject their own constructor fields. They now accept those fields for abstract bases and bases with a widened tag.
- Passing a running call to prelude pipe could give only a TypeScript type mismatch. EK4502 now explains that the call already ran and shows how to pass a program.
- Returning a block-owned fork could silently hand the caller an interrupted fiber. EK4838 now warns and suggests a caller-owned scope or explicit detachment.
- Using provide in an expression could produce unrelated parser errors. The diagnostic now explains that provide is a statement.
- Wide failure, service and match lists could overwhelm diagnostic messages. Each list now shows at most ten members and counts the rest.
- An unsupported Effect installation could be reported as missing. EK1011 now names the resolved version and the required installation.
- A `for...of` whose binding default failed, a `for...of` over an array with its own iterator, and an array destructuring whose default failed left the iterator open: its `return()` never ran. Every live iterator is now closed as JavaScript closes it, innermost first, before the failure is reported.
- Explicitly empty service keys could be missed. A `service Empty {}` key is now recognized.
- Imports from paths containing spaces, `#`, `?` or percent signs could fail at runtime. Generated imports now escape those characters.
- Deeply nested arrow functions could take a long time to check. Effect return inference now shares the guarded type lookup.
- Files with many generated helper names could compile slowly. Generating those names now takes linear work.
- An unresolved or invalid call could also get a misleading unsafe-call error. The compiler now reports the original error without that extra message.
- Cyclic error inheritance could produce errors about generated constructors. Those follow-on errors are now suppressed.
- An error base written as an expression could appear as an internal name in a diagnostic. The message now shows the source expression.
- A missing call pipe could suggest the wrong operation. The diagnostic now gives guidance that applies to the operation you used.
- A large function could get a false non-exhaustive-match error after TypeScript stopped flow analysis. It now keeps only the flow-analysis-limit error.
- Bare program names such as `interrupt` could silently run nothing. See the new diagnostic and call fix in [Upgrade from 0.0.10](#upgrade-from-0010).
- A trailing throw could throw the wrong operand or get a misleading contract error. See the parentheses repair in [Upgrade from 0.0.10](#upgrade-from-0010).
- Error subclasses with a primitive or list base constructor could fail only when instantiated. See the earlier declaration error in [Upgrade from 0.0.10](#upgrade-from-0010).
- A nameless `module { … }` could get platform and call errors. See the naming hint in [Upgrade from 0.0.10](#upgrade-from-0010).
- An `await` binding could compile into invalid JavaScript. See the binding check in [Upgrade from 0.0.10](#upgrade-from-0010).
- An entry could pick a platform layer from the runtime's development dependencies. It now resolves platform packages from the entry's project.
- `const fs = FileSystem; fs.writeFileString(...)` gave an unexplained missing-property error. The message now suggests `FileSystem()` or a direct service call.
- Platform diagnostics could recommend a hatch for an API that has a service. They now point to Effect's `lstat` and home-directory APIs or the [experimental replacements](#experimental-platform-apis).
- An Effect arrow that read `this` only in a parameter default or a class's `extends` clause, or an Effect method that read it only in an `extends` clause, lost `this` and failed with a `TypeError`. Both now keep the enclosing `this`.
- An Effect arrow that read its enclosing function's `arguments` saw a different object, shared by every run of the same Effect; in an anonymous function expression that named its own variable it failed with a `ReferenceError`, and in a plain function it crashed the compiler. It now reads the arguments of the same call, afresh on each run.
- A producer that read `arguments` got an empty object. It now reads the arguments of the call that made its Stream.
- An Effect arrow created in a constructor read `undefined` for `new.target`. It now reads the constructor call's `new.target`, as a plain arrow does.
- An Effect method or arrow that wrote a super property in any form but `super.x = v` and `super.x += v`, such as `super.count++`, `super[key] += v` or `[super.x] = pair`, and an Effect arrow in a class field that used `super`, could compile to JavaScript that failed to load with `'super' keyword unexpected here` or `Invalid left-hand side in assignment`. They now run as JavaScript runs them, evaluating the key once, and a `super.tag` template tag keeps `this`.
- Inside a named Effect function expression or producer, such as `function self(n) { … self(n - 1) … }`, the name meant an internal generator: a call passed by name failed with `Not a valid effect`, deep recursion overflowed the stack, and returning the name returned the generator. The name now means the function itself.
- A binding spelled like a name the compiler generates, such as `answer$direct` beside a function `answer`, `sum$recur`, `work$try` in a function `work`, or `Users_base` beside a service `Users`, could change which function a call ran or what a local held, stop the module from loading with a `SyntaxError`, or make its declaration file invalid. Generated names now avoid every name the file spells.
- An Effect function whose parameter default names the function itself, such as `function f(g: Self = f)`, got the generator that runs its body instead of the function, so the default was not an Effect function. The name now means the function, as in TypeScript.
- A binding or label spelled like a name that `match` or `is` writes, such as `const $match1 = 99` read in an arm, could read the match subject instead of its own value, or stop compilation with a duplicate label. Those names now avoid every name the file spells.
- A binding spelled like a helper that a form calls, such as a `$is` or `$noMatch` function beside a `match`, or `$awaitAll` and `$forConcurrent` beside `await.all` and `for concurrent`, replaced the helper: a match chose the wrong arm or returned the binding instead of failing, and the fiber forms ran the binding instead of their fibers. The forms now always call the runtime's helpers.
- A parameter or local named like a failure class that a call lists, such as `SyntaxError` around `JSON.parse`, replaced the class in the call's generated test: the failure became a `TypeError` defect that `catch` could not receive. The test now reaches the class itself.
- Plain functions that call one another, with a parameter or local named like the function, such as `function even(even: number)`, failed with `TypeError: even is not a function` once the recursion ran deep. The deep path now calls the function.
- A by-name `a() || b()` or `a() ?? b()`, such as `retry(first() || second(), policy)`, tested the Effect that runs `a()` instead of its value, so `b()` never ran. It now tests the value, as the same expression in a lambda does.
- A pipe whose topic stands alone, such as `source() |> sink.take(%)`, could read a getter or a reassigned `let` in its body before it ran its left side. The left side now runs first, unless the body reads only values that can't change.
- `try(f, mapper, input())` evaluated its inputs before its mapper. It now evaluates its arguments in the order written.
- `wire(a(), b())` evaluated `b()` before `a()` when `b()`'s layer needs a service that `a()`'s layer provides. The arguments now run in the order written; only the layers they make are reordered.
- `for concurrent(limit()) (const x of items())` evaluated `items()` before `limit()`, so the loop could iterate items that `limit()` had replaced. The head now runs in the order written.
- An optional chain that went on after a call that runs an Effect, such as `box?.read().value`, crashed with a `TypeError` when `box` was absent, and an optional call such as `codec.parse?.(input())` could run its arguments when skipped. The rest of the chain is now skipped, arguments included.
- A call with expected failures, such as `JSON.parse` read through a getter, read its function after arguments that run an Effect, so the getter ran late and the call could reach a function an argument had replaced. It now reads the function first, as JavaScript does.
- A tagged template whose tag declares expected failures, such as ``tag`text` ``, threw them as defects that `catch` never received, and EK2004 said its `try` could not fail. The template now uses the tag's failures, as a call does.
- A nested pattern that tests and binds a property, such as `{ value: 1 and let n }`, read the property twice, so a getter ran twice and `n` could differ from the value tested. A pattern now reads each part of its subject once.
- An exhaustive `match` without `default` skipped code in its last arm's pattern, such as the getter in `when registry.State.Waiting`. That code now runs.
- `wire(Decorated)`, where `Decorated` provides and needs the same service, was typed as needing nothing and failed with `Service not found`. Its type now keeps that input, as `Decorated`'s does.
- `wire` imported under another name (`import { wire as compose }`), called as `Runtime.wire`, or given a spread array (`wire(...[LA, LB])`) skipped dependency ordering, so a layer could be built before the layer it needs and fail with `Service not found`. These forms are now ordered and checked as `wire` is, and a spread whose layers cannot be listed is EK3204.
- A service declared inside a namespace, `export namespace N { export service S { … } }`, had a declaration file entry without its key type, so TypeScript code could not pass `N.S` to `Layer.succeed` or `Effect.provideService`. Its declaration now matches a top-level service's.
- Effect's `pipe` imported under another name, such as `import { pipe as flow } from "effect"`, or read as `Function.pipe`, got none of the diagnostics that point out where 0.0.10's look-ahead made its first argument a program. It is now recognized under any name, so EK1023, the migration note and `--fix` cover those calls too.
- A `sync` or `try` hatch whose function returned `number | Promise<number>` gave the Promise object where its type promised a number, and one that returned data with a `then` field, such as `{ then: 7 }`, crashed with `then is not a function`. The hatch now waits only for a value whose `then` is a function, deciding per value when the type allows both.
- A pattern recognized built-in matchers by spelling: with a parameter named `String`, `when String` still tested `typeof x === "string"`, and `when Option.None` on your own `data Option` failed with EK2127. A matcher now means what its name resolves to, so those are a variable pattern and your type's variant.

#### Runtime

- Experimental platform layers had the same names as Effect's layers and were easy to confuse. Their exports now start with Experimental; see the import repair in [Upgrade from 0.0.10](#upgrade-from-0010).
- An unhandled typed error from main could print only its tag and omit useful fields. Failure reports now include the error's fields while preserving redaction.
- Loading the native runtime with an incompatible Effect could fail during module linking before the version check. It now reports the supported Effect version first.
- Traced calls could lose their logical caller while forwarding to another function. Tracing now captures that caller before forwarding, including named function expressions and methods.
- Calling a plain VibeLang function from TypeScript with `call`, `apply`, `bind` or as a method could lose `this` and throw a `TypeError`. The generated Effect wrapper now forwards the receiver (reported by Vladimir Kalnitsky).
- Running the same Effect again could see an earlier run's changes to a rest-parameter array or to a method's default parameter value, and program lambdas with optional or rest parameters could fail with a missing-variable defect. Each execution now binds its parameters afresh.
- Running the same Effect again could start from an earlier run's assignment to a parameter, such as `++n` or `n += 1`. Each execution now starts from the original arguments.
- `using` read a value's `[Symbol.dispose]` again at block exit, so replacing the method, or a getter that returned another one, changed which release ran. It now reads the method once, when it acquires the value, as JavaScript does.
- `join` on an object or array read each element twice, so a getter could make it join one fiber and interrupt another. It now reads each element once.

#### Editor and language server

- Hover text could run the inferred contract into the behavior paragraph. A blank separator now keeps them readable.
- Completion after `FileSystem.` or `Experimental.Process.` could omit service members. It now includes the shorthand members.
- Canceling a request during contextual type lookup could leave the editor waiting. That lookup now checks for cancellation.
- Rename could insert an invalid identifier and break the file. The server now rejects invalid replacement names.
- An ordinary `fork` identifier before an operator could be highlighted as a keyword. It now keeps identifier highlighting.
- An ordinary `join` identifier before an assertion or operator could be highlighted as a keyword. It now keeps identifier highlighting.
- Interruption blocks lacked keyword highlighting. `uninterruptible`, `restore` and `interruptible` now receive it in block form.
- Tree-sitter rejected `using` as a parameter or ordinary identifier. It now accepts those contextual uses.

#### Tooling and bundlers

- Release docs checks could fail to load a runtime platform entry with ERR_MODULE_NOT_FOUND. The extracted runtime now resolves its pinned platform peers and Node's shared platform package.
- A running call followed by .pipe(Effect.catchTag(...)) had no catch quick fix. The compiler now offers a VibeLang catch rewrite for a single catch operator.
- `--fix` could leave an unnecessary `Effect.succeed` in a rewritten catch arm. It now simplifies that handler.
- A missing `tsconfig.json` could leave the compiler or bundler retrying forever. It now stops with TS5058.
- The runtime loader could claim an included dependency source was excluded by the project. It now explains that no loader output is available and the dependency needs compiled JavaScript or its own project.
- Webpack could keep a stale bundle after compiler backend or build-dependency changes. Those changes now trigger a rebuild.
- Watch mode could rebuild after an unrelated sibling directory changed. It now ignores those events.
- Redirected watch output could contain terminal-clearing sequences. Output is now cleared only on a terminal.
- A nonincremental `noEmit` build could say a JavaScript output was missing. It now explains that this configuration requires rechecking.
- Cache debugging could say a file changed during compilation when it changed just before it. The message now includes the timestamp safety margin.
- The starter could generate a reserved npm package name. It now normalizes reserved names.
- A long target name could generate an invalid npm package name. The starter now limits package names to 214 characters.
- A target that was a file could produce a filesystem exception. The starter now reports that the target is not a directory.
- A missing package-manager executable could produce an unhelpful spawn error. The starter now names the missing executable.
- The starter's next-step `cd` command could break on spaces or shell characters. It now quotes the directory path.
- An npm-created project's README could tell you to run Bun commands. It now uses the selected package manager.

#### Docs

- Language design inconsistencies were missing from these notes. They now list
  confirmed issues, examples and safe patterns in [Known design issues](#known-design-issues).
- Fixes could land without a changelog entry or matching docs. The contribution rules now require both in the same commit, and the docs tests check the bug-list heading and release versions.
- Platform-global examples could fail when copied from the page. The page now includes the context needed to compile its browser-service, import and export examples.
- Search descriptions could contain fenced source code. The site now skips code blocks when choosing a page description.
- The site's 404 page could appear in search results. It now tells search engines not to index it.
- Saving a captioned test example could fail with missing helper names. Test files now import what they test; shared fragments no longer claim to be standalone files.
- The language skill incorrectly sent transformed schema fields to `Schema.Struct`. It now explains that a schema declaration can use those fields.
- The language skill used a diagnostic code that does not exist. It now names a code the compiler reports.
- The devtools guide said platform values could be imported or passed directly. It now describes the restrictions in [Platform code](#platform-code).
- The platform installation guide could install mismatched package versions. It now uses the [exact-version setup instructions](../setup/existing-project.md).
- The language skill showed outdated config access and omitted a complete scoped-file example. It now uses Effect 4's `Config.String` and shows scoped cleanup.
- Migrating files with the same stem could overwrite emitted output. The [migration guide](../setup/existing-project.md) now explains the collision and how to rename files.
- Starter tracing instructions were missing. The [getting-started guide](../013-getting-started.md) now shows how to opt in during development.
- Declaration consumers were not told the minimum TypeScript version. The [installation guide](../getting-started/004-installation.md) now requires TypeScript 5.7 or later.
- The Bun test recipe omitted declaration and project setup. The [CLI guide](../setup/vibelang-cli.md) now includes both.
- The Bun preload instructions could imply that watch and hot reload rebuild VibeLang files. The [CLI guide](../setup/vibelang-cli.md) now explains their limits.
- The formatting guide implied that every comment prevented formatting. It now limits that refusal to comments in rewritten clause chains.
- The examples README did not state the required Effect version. It now gives the exact pin.
- macOS VSIX instructions could fail because `code` or `cursor` was not on `PATH`. The [editor guide](../setup/vscode.md) now includes shell-command setup.
- The proposals page described shipped bundler adapters as future work. It now identifies the adapters already available.
- The repository home page showed benchmark results without measurements. It now gives commands to reproduce the benchmarks.
- The agent essentials used an undeclared layer binding. The example now declares the layer before providing it.
- Stacked fixes could leave the published docs and compiler form tables out of date. Both are now regenerated from the complete release stack.
- The language skill claimed Node and Bun entries supplied Locks. It now requires an explicit Locks layer and explains its platform limits.
- The diagnostic guide omitted registered codes and their repairs. It now lists them and checks coverage against the compiler registry.
- The diagnostic guide omitted the adjustable editor warning EK9100. It now identifies its default severity and editor-only behavior.
- The platform guide lacked a complete HTTP request that read the response body. It now checks a JSON request with FetchHttpClient.layer.
- A copied module-block Node import could fail because the starter disables Node declarations. The guide now installs @types/node and enables those types explicitly.
- The process exit guidance did not explain numeric main returns. It now states that normal return exits 0, failure exits 1 and interruption exits 130.
- The contributor compiler-case command could run without runtime dependencies. It now installs them before the case suite.
- Bun starter instructions could imply the generated app ran on Bun. They now distinguish the package manager from the Node runtime and link to Bun runtime setup.
- A platform import in a shared module could appear to supply services. The guide now explains that non-entry imports are removed and the entry must supply the platform.
- The Bun stack guide discussed only source-loader locations. It now also explains unmapped emitted-JavaScript stacks and the Node source-map command.
- The Vitest recipe could exclude test sources through the app project. It now selects a separate test project and includes a Node test-runner recipe.
- The React and Vite guides incorrectly required import rewriting for vite build. They now explain the plugin enables it automatically and distinguish direct CLI emission.
- The Vue and Svelte guides incorrectly required import rewriting for vite build. They now explain the plugin supplies it and keep the separate CLI requirements.
- The Vue and Svelte guides said an excluded VibeLang test fails with ENOENT. They now show the project-include error and the glob that repairs it.
- The Vue build guide omitted unresolved imports alongside vue-tsc's rewrite errors. It now identifies TS2307 for ./todos.vibe in runtime.ts and TodoBoard.vue.
- The late diagnostic reference omitted statement, escaping-fiber and mapper guidance. It now explains EK1017, EK4838 and the editor-only EK9101 with their repairs.


### Known bugs

These bugs were found and confirmed and are being fixed; please don't re-report them, and each entry moves to the fixed list when its fix lands.

#### Generated names

- Your names can collide with the compiler's own names: for example,
  `answer$direct`, `sum$recur`, `work$try`, `$match1`, `$is`, `$noMatch`,
  `$awaitAll`, `$forConcurrent` or `Users_base`. Calls and patterns can use
  your value, or generated JavaScript and declarations can contain duplicate
  names. A local `SyntaxError` can also break the generated error check for
  `JSON.parse`. Rename the colliding source binding (see Known design issues).

#### `this`/`arguments`/`super` in effectful functions

- An effectful arrow that uses `this` only in a parameter default, a nested
  class's `extends` expression or a computed member name can lose its receiver
  and throw (see Known design issues). Capture `this` in a local before the
  arrow and use that local.
- A named effectful function expression that calls or returns its own name
  can refer to a generator instead of the function: retries can crash and
  recursion can overflow the stack. A declaration's self-reference in a
  parameter default can also return the wrong function. Use an anonymous
  function referring to its outer variable, and avoid self-referencing defaults
  (see Known design issues).
- `super.count++`, `--super.count` and computed compound assignments such as
  `super[key()] += value()` in an effectful method can produce JavaScript
  that fails to load or an invalid assignment target. Use separate reads and
  simple assignments, saving a computed key once (see Known design issues).
- A nested effectful arrow that reads `arguments` can see a different object
  from its enclosing function; mutations can also carry over between runs
  of the same program. Capture `const args = arguments` in the enclosing
  function body and share that local (see Known design issues).
- A producer that reads `arguments[0]` can yield `undefined` instead of its
  first argument. Use named parameters in the producer body
  (see Known design issues).
- An effectful arrow created in a constructor can see `new.target` as
  `undefined`. Capture `const target = new.target` in the constructor and
  read `target` from the arrow (see Known design issues).

#### Evaluation order

- `||` and `??` inside a program argument can test the cold Effect object
  instead of the call's result, skipping a fallback that should run. Pass a
  block program that stores the expression in a local before returning it
  (see Known design issues).

  ```vibe
  // fragment
  Effect.retry(first() || second(), { times: 0 })
  Effect.all([absent() ?? fallback()])
  ```

- Continuing an optional chain after an effectful call, as in
  `box?.read().value`, can throw when `box` is absent. Check the receiver
  explicitly before calling and reading the result.
- A value pipe such as `source() |> sink.take(%)` can read the stage's getter
  or function before running `source()`, reversing side effects or calling
  an old function. Store the left value in a local before applying the stage
  (see Known design issues).
- A trusted method call with effectful arguments can evaluate those arguments
  before looking up the method. Optional trusted calls can run arguments
  that should be skipped and can then throw. Check optional receivers and
  callables first, and save the method before evaluating its arguments.
- A `sync` or `try` hatch returning a scalar-or-Promise union can hand back
  an unresolved Promise despite a scalar result type; ordinary data with a
  non-callable `then` property can instead be treated as a Promise and crash.
  Use an async callback for mixed returns, or the runtime hatch adapter
  imported under an alias for data with a `then` field.
- `try(evaluate, makeMapper(), input())` can run `input()` before
  `makeMapper()`. Evaluate the mapper and inputs into locals in written order
  before calling the hatch.
- `wire(makeA(), makeB())` can evaluate layer factories in dependency order
  instead of the order you wrote, changing their side effects. Build the
  layers into locals in written order, then pass those locals to `wire`.
- `for concurrent(limit()) (const item of items())` can evaluate `items()`
  before `limit()`, even selecting an old collection and skipping work.
  Evaluate the limit into a local before the loop.

#### Errors

- When both a `try` body and its `finally` fail in an otherwise plain
  function, cleanup can replace the original failure instead of preserving
  both causes. An outer catch can receive the cleanup error instead of the
  original one (see Known design issues).
- A call in a catch binding's default can fail or need a service that the
  function's checked contract and declarations omit. Move destructuring
  and defaults into the catch body.

  ```vibe
  // fragment
  catch ({ id = fallback() }) { return id }
  ```

- An error subclass without its own constructor can lose its own fields when its base has a custom constructor that rebuilds the argument object.
- An error subclass such as `error Child extends Base<number>` can be
  rejected because its generated constructor forgets the base's type
  arguments. Write an explicit constructor accepting the base and subclass
  fields and passing them to `super`.
- Throwing `Cause.fail(...)` inside an otherwise plain function can give
  `catch` the whole Cause instead of its error; `Cause.die(...)` can even
  be caught as an expected failure. Use `Effect.failCause` explicitly.
- A trusted tagged-template call can let its declared expected error escape
  as a defect, bypassing `catch`. Use an ordinary call to the trusted function
  where its API supports one.

#### Concurrency and resources

- Aggregate joins and races can hang during cancellation if one child's
  cleanup waits for another child's cleanup: children are interrupted one at
  a time. Avoid dependencies between sibling finalizers; when managing fibers
  explicitly, `Fiber.interruptAll` signals them together.
- Holding `const p: number[]!! = await.all items` can iterate `items` while
  constructing the program and reuse that snapshot on every run. The same
  issue affects `await.allSettled`, `await.race` and `await.any`. Wrap the
  whole await expression in a block program so it is constructed afresh per run
  (see Known design issues).
- `using` looks up `Symbol.dispose` or `Symbol.asyncDispose` again at cleanup
  time. Replacing the method, or using a getter that returns different methods,
  can run the wrong disposer. Keep the disposal method stable for the lifetime
  of the binding.
- `join tasks` can read object getters or array entries twice, joining a
  different child from the one used for cancellation. Copy the selected fibers
  into a plain collection once before joining.
- `join` rejects a valid `Record<string, Fiber.Fiber<number>>`, yet can
  accept a record whose index signature also permits non-fibers and then
  crash. Use an object with explicit fiber properties, or map valid dictionary
  entries through `Fiber.join` and `Effect.all`.
- Assigning to a `const` binding in a `for concurrent` head is accepted and
  changes the value, including destructured bindings. Keep those bindings
  unchanged; introduce a separate local for mutable state.
- A `for...of` whose destructuring default runs an Effect can leave its
  iterator open when that default fails. Move the destructuring and default
  into the loop body.
- Array destructuring such as `const [n = fallback()] = values` can leave
  its iterator open if the Effect default fails. Destructure first, then run
  the fallback after destructuring has finished.
- An effectful `for...of` over an array with a custom iterator can skip
  iterator cleanup on failure. Bind the array as `Iterable<T>` before looping
  so it uses the protected iteration path.

#### Services and layers

- A service's `static readonly default` is not checked against its declared
  shape or method contracts. Wrong value types, hidden failures or plain
  methods where Effect methods are required can compile and then fail or
  return the wrong type. Use an explicitly checked provider such as
  `Layer.succeed` for the implementation.
- Providing a choice between layers or contexts can claim that every branch's
  services are available, even though only one branch runs. Missing-service
  failures then appear at runtime despite a closed contract. Branch around
  separate provider blocks, or make every branch supply the required services.
- A possibly empty array of layers can count as providing its element type's
  services even when the array is empty. Use a nonempty provider tuple or
  provide the required layer directly.
- Calling `wire` through an import alias, a namespace or a tuple spread can
  skip dependency ordering and fail with a missing service. Use the direct
  `wire(layerA, layerB)` form with explicit arguments.
- `wire(layer)` can erase a layer's requirement for the same service it
  produces, even though building that layer still needs an external provider.
  Use the layer directly and supply its input service.
- `provide` accepts values that are neither layers nor contexts, such as
  `provide 123 { ... }`, and crashes at runtime. Pass a layer, a nonempty
  tuple of layers or a context.

#### `match` and `data`

- Matching `Option<A> | string` with the Option arms first can be rejected
  because the generated tests require an already narrowed Option. Put the
  disjoint `String` arm first.
- A match covering every nested data variant can still be reported as
  non-exhaustive. Match the nested field separately, or add a fallback arm.
- A nested property pattern that both tests and binds a getter's value can
  read it twice, binding a different value from the one that passed the test.
  Read the property into a local and match that saved value.
- A variable pattern named `String`, `Number` or another built-in matcher
  can ignore your binding and use the built-in test; a data type named
  `Option` can be mistaken for Effect's Option. Rename the source binding
  (see Known design issues).
- A custom extractor inside an `or` pattern can be
  rejected because its generated result is not kept for narrowing. For `or`,
  use separate adjacent match arms instead.
- The final arm of an exhaustive data match can skip evaluating the matcher
  expression, including its getters. Store the matcher value in a local before
  matching if its lookup must run (see Known design issues).

#### Modules and declarations

- Mutable exports from an inline `module` are snapshots: named imports,
  namespace imports and re-exports can keep the initial value after updates.
  Export a getter function, or move the module to a separate TypeScript module
  (see Known design issues).
- A dynamic import of a VibeLang source can keep the source extension when
  extension rewriting is disabled, or fail to escape URL characters such as
  `#` when it is enabled, so the emitted module cannot be loaded. Use a static
  import where possible.
- Importing Effect's `pipe` under another name can reject a program argument
  that works with the name `pipe`. Keep that import named `pipe`
  (see Known design issues).
- CommonJS imports of source modules with spaces or URL characters in their
  names can request an encoded filename that does not exist. Rename the
  source module to avoid those characters.
- A service inside a namespace can work at runtime but lose its service-key
  API in generated declarations, so TypeScript consumers reject it as a
  provider key. Declare and export the service at the top level.

#### `--fix` and the formatter

- Formatting can reorder value imports and change the order in which their
  modules initialize, changing program behavior. Disable import-declaration
  sorting in the formatter settings when initialization order matters.
- `--fix` can discard comments when converting tagged error fields or
  unwrapping `Effect.succeed` and `Effect.fail`. Preserve those comments when
  applying the change manually.
- Converting `catchTag` or `catchTags` to a class pattern can stop catching
  a copied or structural error that has the right `_tag` but no class
  prototype. Keep a structural tag pattern, or keep the original call.
- Converting `catchTags` can reuse one handler's parameter as the shared
  catch binding and capture a different handler's outer variable, changing
  its result. Apply the rewrite manually with a fresh catch binding
  (see Known design issues).
- Import cleanup after a form rewrite can remove an entire import and
  silently skip that module's initialization. Retain a side-effect-only
  import when its initialization is needed (see Known design issues).
- Converting `Effect.provide(programExpression, layerExpression)` to a
  provider block can evaluate the layer before the program expression.
  Evaluate the program into an explicitly Effect-typed local first, then
  evaluate the provider and run the saved program inside its block
  (see Known design issues).
- Converting a `Context.Service` class can delete evaluation of a dynamic
  key expression such as `keys.pop()`. Keep the original declaration when
  evaluating the key has side effects (see Known design issues).
- The editor's quick fix from a tagged error class can truncate a constrained
  generic parameter or a comment containing `extends`, leaving invalid syntax.
  Preserve the full type parameter list when converting manually; CLI `--fix`
  refuses this malformed edit.
- One `--fix` invocation can stop after 16 rounds with deeply nested,
  overlapping fixes still available. Run it again until it reports no edits.


### Known design issues

The language design has these confirmed inconsistencies; the specification is
being revised, programs that rely on them may change, and each change will be
listed with an upgrade step.

- **A parameter type can move argument work in time.** An `Effect` parameter
  passes the whole call expression by name, so even its receiver and inputs
  can run again on every retry, after later arguments have already run.
  A mixed `Effect<number> | number` parameter or an unfixed generic `T`
  instead runs the argument at the call; fixing `T` from another argument
  can change that choice. Overload selection can choose this strategy and
  a callback's function-or-program representation. The same issue reaches
  program topics in pipes and elements passed to `Effect.all`.
  Vladimir Kalnitsky raised the central call-argument issue. Today, save
  inputs in locals when they must run once, and use an explicit block program
  when work must repeat; check the selected signature after library updates.

  ```vibe
  // fragment
  retry(fetchUser(nextId()), policy) // nextId can run on every attempt
  acceptMixed(fetchUser(nextId())) // Effect<User> | User: runs at the call
  acceptGeneric(fetchUser(nextId())) // unfixed T: runs at the call
  ```

- **Annotations can run a value or hold it as a program.** An inferred
  binding runs a call, while an explicitly Effect-typed `const` holds it;
  object fields, conditional initializers and factories add more holding
  rules. A factory's outer body can run while constructing the held program.
  At a return boundary, whether an Effect subtype is data also depends on
  the written or contextual success type, so widening it can stop work from
  running. Today, use `const p = () => work()` to defer work explicitly,
  save construction inputs separately, and call a returned program as `p()`
  when execution is intended, including in release callbacks.

  ```vibe
  // fragment
  const value = work() // runs here
  const held: number!! = work() // holds a program
  const explicit = () => work() // explicit deferred body
  ```

- **Some names are recognized by spelling.** A local named `Number`,
  `String` or `Option` can receive built-in pattern behavior instead of its
  own meaning. A top-level call named `runSync`, `runPromise`, `runMain`,
  `runFork` or `runCallback`, even a property on your own object, can suppress
  automatic entry execution. Aliasing helpers such as `pipe` can also lose
  their special handling. Today, avoid built-in matcher and runner spellings
  for unrelated bindings, retain documented helper names, and check that
  `main` still runs after a rename.

  ```vibe
  // fragment
  const helper = { runSync: (n: number) => n * 2 }
  const doubled = helper.runSync(21) // can suppress the entry for main
  ```

- **Plain `finally` and Effect `finally` combine failures differently.**
  The plain JavaScript path can replace the body's failure with cleanup's
  failure; the Effect path retains both causes. Adding an Effect operation
  can therefore change the error an outer catch receives. Today, keep fallible
  cleanup in an explicit Effect program and combine it with the body using
  `Effect.onExit`; avoid relying on plain `finally` to preserve both failures.

  ```vibe
  // fragment
  try { throw new BodyError() }
  finally { throw new CleanupError() }
  ```

- **`using` can dispose the same resource twice.** If an acquisition's
  registered release already calls a Disposable's disposer, `using` also
  calls `Symbol.dispose` at block exit. Sync and async disposal do not share
  one ownership rule. Today, return a plain holder from `Effect.acquireRelease`,
  bind that holder with `using`, and dispose only `holder.value` in the
  explicit release callback. See also the pending-interruption limitation below.

  ```vibe
  // fragment
  using resource = Effect.acquireRelease(() => openDisposable(),
    (r) => sync((value) => value[Symbol.dispose](), r)) // two disposals
  ```

- **Inline `module` imports are snapshots.** Named imports, namespace imports
  and re-exports can keep an exported `let`'s initial value after it changes,
  unlike ordinary TypeScript live imports. Inline-module initialization order
  and case-insensitive module names also depart from ordinary module rules.
  Today, export a getter for mutable state, use distinct names that differ by
  more than case, and move initialization with ordering dependencies to
  separate `.ts` modules.

  ```vibe
  // fragment
  module state { export let count = 0; export function bump() { count++ } }
  import { count, bump } from state
  bump() // count can still be 0
  ```

- **An open error family does not get exhaustive matching.** Covering the
  subclasses you know does not close a base family; a match without `default`
  can compile and turn an unhandled expected error into a `TypeError` defect.
  An empty typed error channel does not rule out defects. Today, add a
  base-family arm or `default: throw e` to rethrow unmatched errors, or expose
  an explicit closed union when exhaustive recovery is required.

  ```vibe
  // fragment
  catch (e) { return match (e) {
    when KnownError: 1; // another subclass of the family can arrive
  } }
  ```

- **Extracting a callback type alias changes what callbacks are accepted.**
  An inline function type without a contract gains effect polymorphism;
  an alias of the same TypeScript type stays plain and can reject a callback
  that pauses or needs a service. Today, write the callback's `A!E!R` contract
  explicitly in reusable types and keep synchronous callbacks plain.

  ```vibe
  // fragment
  type Fn = (n: number) => number
  function inline(f: (n: number) => number) { return f(1) }
  function aliased(f: Fn) { return f(1) } // different callback contract
  ```

- **A generic return type can decide whether a result runs.** Calls whose
  instantiated return type is Effect run their result, while mixed unions
  and structured Effect subtypes can remain data; an optional call has its
  own running rule. A generic identity helper is therefore not necessarily
  an inert pass-through for a program. Today, avoid routing program values
  through such helpers: return a holder such as `{ program }` to keep one
  as data, and call `holder.program()` explicitly when it should run.

  ```vibe
  // fragment
  declare function identity<T>(value: T): T
  identity(savedProgram) // instantiated Effect result can run
  ```

- **Structural service shapes can erase service identity.** The optional
  service brand can disappear through an intermediate structural type, letting
  a program that needs one key be relabeled as needing another. Providing the
  second key then compiles but fails at runtime. Today, preserve the exact
  service identifiers in Effect and Layer contracts, avoid widening R through
  implementation shapes, and provide the key the program actually requests.

  ```vibe
  // fragment
  const erased: Effect<number, never, { get(): number!! }> = needsAlpha
  const claimed: Effect<number, never, Beta> = erased // still needs Alpha
  ```

- **An aliased hatch can pass different arguments from a direct hatch.**
  Direct `sync`/`try` calls use types to choose signal injection and mapper
  positions; their first-class runtime values cannot see those types. An
  optional numeric parameter can receive an AbortSignal through an alias.
  Today, use direct hatch syntax with explicit inputs and a callback whose
  parameters unambiguously accept them; declare a signal parameter only when
  intended, and keep `try`'s mapper explicitly second.

  ```vibe
  // fragment
  sync(nativeAsyncWithOptionalNumber, 1) // optional number stays undefined
  const h = sync
  h(nativeAsyncWithOptionalNumber, 1) // optional number can get a signal
  ```

- **A plain return annotation changes foreign-call failure handling.**
  A TypeScript call that needs a trust boundary in an Effect function can
  become an ordinary call inside a plain-annotated helper; trusted listed
  failures can become defects rather than enter E. A plain annotation is
  therefore no proof that foreign code cannot throw. Today, use an explicit
  `try` hatch to map expected exceptions and declare the resulting error
  contract, including inside helpers; do not use a plain wrapper to bypass
  a boundary diagnostic.

  ```vibe
  // fragment
  function plain(n: number): number { return foreignRisky(n) }
  function computational(n) { sleep("1 millis"); return foreignRisky(n) }
  ```

- **Omitted contract channels do not have one meaning everywhere.**
  `A!E` on a function with a body infers R, while `Effect<A, E>` uses
  TypeScript's default of `never`; an omitted R in a callback type also
  means `never`. Completing an error contract can also change whether callers
  see a broad declared error family or narrower inferred errors. Today,
  spell all three channels, using `infer` where inference is intentional,
  and check emitted declarations after extracting a signature.

  ```vibe
  // fragment
  function inferred(): number!Bad { return Store.read() } // R inferred
  function closed(): Effect<number, Bad> { return Store.read() } // R = never
  ```

- **Changing an arrow's braces can change a fork's lifetime.**
  A block-bodied arrow owns its `fork` child and interrupts it on block exit;
  an expression-bodied arrow uses the caller's Scope. Returning the child
  can therefore hand back an already interrupted fiber. Today, keep ownership
  blocks explicit, join children before leaving them, and use
  `forkIn(scope, program)` with a caller-owned scope for a child that must escape.

  ```vibe
  // fragment
  const shortLived = () => { return fork work() }
  const callerScoped = () => fork work() // different owner
  ```

- **Timeouts and races can discard cleanup failures.** The promise that
  cleanup failures are preserved applies to local finalization, but pinned
  Effect's `timeout`/`race` can discard a losing fiber's final exit, including
  its cleanup failure. Today, record failures inside the child's finalizer
  before it exits; if every cause is required, manage and observe each
  child's `Exit` explicitly rather than relying on the race's parent cause.

  ```vibe
  // fragment
  timeout("10 millis") {
    try { sleep("1 hour") } finally { throw new CleanupError() }
  } // parent can report only TimeoutError
  ```

- **Effect member lookup depends on declaration conventions.** Synthesized
  data methods depend on a receiver parameter named `self`, `*OrOptions`
  or a special-case table. Real members and a module's own exports win over
  synthesized methods and same-named service exports, so an Effect update
  can silently redirect a call. Today, keep the exact Effect pin, prefer
  explicit module functions such as `Stream.take(stream, 3)`, and call a
  service through its explicit key when a module export would be ambiguous.

  ```vibe
  // fragment
  stream.take(3) // synthesized from the library declaration
  Stream.take(stream, 3) // explicit module function
  ```

- **Construction and execution phases are not fully specified.**
  Defaults, destructuring, getters and collection iteration do not share
  one complete phase rule with cold calls, factories and held values. A
  reusable Effect also need not recreate a captured iterator, hot Promise
  or resource. Today, evaluate once-only inputs into locals, create fresh
  inputs inside an explicit program when each run needs them, and avoid
  side effects in defaults or getters at these boundaries.

  ```vibe
  // fragment
  const shared = () => consume(iterator) // captures one iterator
  const fresh = () => consume(makeIterator()) // creates one per run
  ```

- **Generated bindings lack one general capture-avoidance rule.**
  The specification has local naming fixes but no universal requirement that
  generated names preserve every source binding. A legal user name can
  therefore be captured by a generated helper. Today, avoid the compiler
  helper names listed under Known bugs and rename a colliding local.

  ```vibe
  // fragment
  const savedAnswer = 99 // avoid a helper name such as $match1
  const answer = match (1) { when 1: savedAnswer; default: 0; }
  ```

- **Moved function bodies lack one complete lexical-context rule.**
  The specification's separate receiver and closure promises do not cover
  every use of `this`, `arguments`, `new.target`, `super` and a named
  function expression's self-binding through suspension and reruns. The
  implementation symptoms and repairs are listed under Known bugs. Today,
  capture source activation values before creating effectful arrows, use
  named producer parameters, and use simple `super` reads and assignments.

  ```vibe
  // fragment
  const receiver = this
  const later = () => { sleep("1 millis"); return receiver.value }
  ```

- **A generator's annotation selects its runtime protocol.** An unannotated
  `function*` is a Stream producer, while an explicit `Generator` or
  `AsyncGenerator` return annotation selects a native JavaScript iterator.
  Adding a type can therefore change how the result is consumed and which
  operations are allowed. Today, keep native generators in a `.ts` module
  and use a VibeLang producer consistently for Stream work.

  ```vibe
  // fragment
  function* produced() { yield 1 } // Stream producer
  function* native(): Generator<number> { yield 1 } // JavaScript iterator
  ```

- **Separate compilation has no complete semantic metadata contract.**
  The specification promises checked handler and callable behavior across
  packages while also saying some control metadata is not emitted
  or read. An Effect-shaped declaration alone cannot certify a foreign
  callback's fiber behavior or a factory's construction phase. Today, keep
  compiler and runtime versions aligned, inspect emitted contracts, and
  keep handler-sensitive code together or behind explicit trusted adapters;
  do not infer continuation safety from a `.d.ts` return shape alone.

  ```vibe
  // fragment
  declare function externalWork(): number!! // shape alone is no certificate
  const p = () => externalWork() // verify the boundary before using a handler
  ```

- **A type-correct rewrite can still change behavior.** Automatic fixes and
  optimizations lack one common requirement covering values, causes, evaluation
  phase, bindings and ownership. Checking that a rewrite adds no errors does
  not prove those observations are preserved; even an exhaustive final match
  test can have an observable getter. Today, review automatic fixes, preserve
  explicit scopes and once-only locals, and compare effects and cleanup in
  tests before accepting a rewrite at these boundaries.

  ```vibe
  // fragment
  Effect.provide(makeProgram(), makeLayer())
  provide makeLayer() { makeProgram() } // construction order can change
  ```

### Known limitations

- A JavaScript Disposable acquired while interruption is masked can leak if
  interruption is already pending when the mask ends, before `using`
  registers disposal (`scopes-using-pending-interrupt`). Use
  `Effect.acquireRelease` with its default protected acquisition, return a
  plain holder `{ value: disposable }`, and dispose `holder.value` in
  the release callback. Bind the holder with `using` to avoid double
  disposal. See [the pending-interruption limitation and safe pattern](../resource-management/030-scope.md#known-limitation-pending-interruption-and-javascript-disposables).
- Platform checks are static, lint-strength checks, not a sandbox. Aliases
  such as `const g = globalThis; g.process.pid`, calls through `as any`,
  and `Reflect.get` can bypass them. See [the scope of platform checks](../platform/platform-globals.md#limits-of-static-checks).
- `Intl.DateTimeFormat().format()` reads the current clock without EK4403
  when no argument is supplied. Read time with `Clock` and pass the value
  explicitly. See [clock-check limitations](../platform/platform-globals.md#limits-of-static-checks).


### Platform

- The file that exports `main` names its platform once with
  `import "vibelang/platform/node"` (or `"vibelang/platform/bun"`,
  `"vibelang/platform/browser"`). When `main` needs services of that
  platform's bundle, such as `FileSystem` and `Path`, the compiled module
  runs it with the bundle's layer, so `main` no longer writes
  `provide NodeServices.layer`. The import loads nothing; the compiler removes
  it. A `provide` inside `main` still wins, tests provide their own layers,
  and EK3205 names only the services the layer does not provide, with the
  layer that provides each of Effect's and the experimental ones. Without the
  import, nothing changes, and EK3205 names the import that would provide
  the platform's services. A file names one platform: a second, different
  platform import is error EK3206.

### Experimental platform APIs

- `Experimental`, in scope in every `.vibe` file, holds what Effect lacks.
  Each service has its own key; it is experimental and goes when Effect ships
  the API. See
  [Experimental platform APIs](../vibelang-features/118-experimental-platform-apis.md).
  - `Experimental.FileSystem` adds `access(path, { executable })`,
    `open(path, { nonBlocking })` and `File.chmod` to Effect's `FileSystem`.
    `lstat` is Effect's own since 4.0.6.
  - `Experimental.Crypto` adds `hmac`, `sign` and `verify` (ECDSA P-256 and
    Ed25519) to Effect's `Crypto`, with secret keys as `Redacted<Uint8Array>`.
  - `Experimental.Process` reads the process id, platform, architecture,
    executable, versions, host name, available parallelism, time origin and
    memory use, and signals processes with `kill` and `isRunning`. The home
    directory is Effect's `UserDirectories.home()`. Browsers have no
    `Process` layer.
  - `Experimental.Locks` holds Web Locks with `hold`, `tryHold` and `query`.
    Node.js's `ExperimentalNodeLocks.layer` locks only within one process; Bun has no
    layer.
- The experimental `FileSystem` and `Crypto` keys are class services, as
  Effect declares them. Their implementations, `Experimental.FileSystem.Service`
  and `Experimental.Crypto.Service`, are supersets of Effect's interfaces, but
  the services are not Effect's: a layer of Effect's `FileSystem` or `Crypto`
  does not provide them.
- `vibelang-runtime/experimental/platform-node`, `-bun` and `-browser` hold
  the layers. `ExperimentalNodeServices.layer` and `ExperimentalBunServices.layer` there are the
  platform bundles plus `FileSystem`, `Crypto` and `Process`, and
  `ExperimentalBrowserServices.layer` provides `Crypto` and `Locks`. A layer of a
  service that extends Effect's provides the experimental service and
  Effect's from one implementation.
- `vibelang-runtime` lists `@effect/platform-node`, `@effect/platform-bun` and
  `@effect/platform-browser` 4.0.6 as optional peer dependencies.
- EK4402 names the experimental service instead of a hatch, with no import:
  `Experimental.FileSystem` for `X_OK` and `O_NONBLOCK`, `Experimental.Crypto`
  for HMAC and signatures, `Experimental.Process` for `os.hostname()`,
  `process.pid`, `process.kill` and the other calls it replaces, and
  `Experimental.Locks` for `navigator.locks`. It names Effect's own
  `FileSystem.lstat` for `lstat` and `UserDirectories.home()` for
  `os.homedir()`.

### Prelude

- Every module of `effect`'s subpath packages is in scope without an import,
  as the root's modules are: `HttpRouter`, `HttpClient`,
  `ChildProcess`, `ChildProcessSpawner`, `TestClock`, `Hex`, `SqlClient` and
  the rest. Imports you already have keep working and shadow the global. Where
  two names meet, a JavaScript or shared web global wins (`Headers`,
  `Response`, and now `Event`), then a root module (`Utils`); `Model` and
  `Prompt`, which two subpath packages share, still need an import, and
  TS2304 names both. With the DOM in `lib`, the bare name `Worker` is now
  `effect/workers`' module; use `globalThis.Worker` inside a hatch or TypeScript module for the DOM constructor.
  [Effect's modules](../getting-started/008-importing-effect.md) lists every
  collision.
- A module's name also names its export of the same name, wherever the module
  has no meaning of its own, a deliberate change from TypeScript: the
  type `Option<number>` is `Option.Option<number>`, `FileSystem.readFileString(path)`
  calls the `FileSystem` service with no import, `FileSystem()` is its
  implementation, and a member the module lacks reads the export, as
  `FileSystem.of` does. A service's value member reads from its
  implementation, `Path().sep`; `Path.sep` is EK4503, as it is on the key. The module's own exports win, so `Option.some` and
  `FileSystem.layerNoop` keep their meaning and `Option.Option<A>` still
  compiles. The same holds after `import { Prompt } from "effect/ai"`, and
  for the experimental services: `Experimental.Process.hostname()`
  calls the `Process` service with no import. In a
  type, the DOM's `Cache`, `Console`, `Crypto`, `FileSystem`, `Scheduler`,
  `Transferable` and `Worker` lose their bare names; alias one in a `.ts`
  file to use it.
- An error on a name these rules settle says which meaning the name has and
  how to reach the other: `function send(m: Message)` (TS2709) names Effect's
  `effect/cluster/Message`, `new Worker("./worker.js")` (TS2351) names
  `globalThis.Worker` for the DOM's, and `Number.sum(1, 2)` (TS2339) says
  JavaScript's `Number` wins and suggests
  `import { Number as EffectNumber } from "effect"`.
- `vibelang --fix` removes the imports these make redundant and writes
  `M.M` as `M` where the module's name means its export:
  `FileSystem.FileSystem.readFileString(path)` becomes
  `FileSystem.readFileString(path)` and `Option.Option<number>` becomes
  `Option<number>`. Run it once after you update.

### Platform code

- Node.js reaches a `.vibe` file only through Effect's services or by
  escaping to TypeScript. Node's globals (`process`, `Buffer`,
  `require`, `__dirname`, ...) and the web's globals that do I/O or read the
  clock or randomness (`fetch`, timers, `console`, `crypto`, `performance`,
  `localStorage`, ...) are no longer in scope in `.vibe`, holding one as a
  value included, and a `.vibe` file no longer imports a `node:*` or bare
  Node.js module as a value. Each is EK4402, which names the replacement.
  `import type` from them, ECMAScript's built-ins, the web's pure helpers
  (`URL`, `TextEncoder`, `structuredClone`, `AbortController`, ...), and
  `.ts` files are unchanged. [Platform globals](../platform/platform-globals.md)
  lists every answer. How to fix each kind:

  | You wrote | Write instead |
  | --- | --- |
  | `import { join } from "node:path"` and the like | the Effect service with no import: `Path.join(directory, name)`, `FileSystem.readFileString(path)`, `ChildProcessSpawner.string(ChildProcess.make(command, args))` |
  | `process.env.NAME` | `Config.String("NAME")()` |
  | `process.argv`, `process.cwd()` | `Stdio.args()`, `Path.resolve()` |
  | `process.pid`, `os.hostname()`, `fs.lstat` | VibeLang's experimental services, such as `Experimental.Process.pid()` |
  | `console.log`, `setTimeout`, `crypto.randomUUID()` | `Console.log`, `sleep`, `Crypto.randomUUIDv4()` |
  | `Buffer.from(text)` | `new TextEncoder().encode(text)`, or `Base64` and `Hex` |
  | a Node.js value an Effect API takes, such as `createServer` | a `module` block that imports it: `module node { export { createServer } from "node:http" }`, then `import { createServer } from node` |
  | a Node.js API nothing covers yet | the same `module` block or a `.ts` file, called through a hatch |

## 0.0.10

Update `vibelang`, `vibelang-runtime` and the bundler plugin together. This
release restores the terse contract syntax and fixes resource cleanup,
recursion and matching. It also adds diagnostics: see the migration details
under Diagnostics before updating code that compiled on 0.0.9.

### Effect 4.0.6 and failures

Use exactly `effect@4.0.6`. Update `@effect/platform-node`,
`@effect/platform-bun` and `@effect/vitest` to `4.0.6` when used, and set
the `@effect/platform-node-shared` override to `4.0.6`. The starter includes
these pins. Syntax and error-channel types are unchanged.

A failure whose cleanup crashes is now a defect, following Effect 4.0.6:

```vibe
error Busy

function save() {
  try {
    throw new Busy()
  } finally {
    die("flush crashed")
  }
}
```

Before, `exit(save())` contained `Fail(Busy) + Die("flush crashed")`.
Now it contains `Die(Busy) + Die("flush crashed")`, in that order, and
`cause.hasFails()` is false. The same rule applies to cleanup from `using`,
producers and abandoned continuations, and to combined concurrent failures.
A `catch` does not recover these defects. Effect's typed recovery operators
(`result`, `option`, `ignore`, `catchTag`, and fallbacks) now preserve them
too; `await.allSettled` propagates the defect instead of returning a failed
`Result`. `Effect.catchDefect` sees the original error first.

A failure beside an interruption, with no defect, is now caught:

```vibe
error CleanupFailed

function stopped() {
  try {
    interrupt()
  } finally {
    throw new CleanupFailed()
  }
}

function recover() {
  return stopped() catch "recovered"
}
```

Before, `recover()` propagated `Interrupt + Fail(CleanupFailed)`. Now it
returns `"recovered"`, as `Effect.catch` does: the first expected failure
reaches the handler and the accompanying interruption is dropped. Catch
statements and handler expressions follow the same rule. Interruption alone
still propagates, and pending cancellation of the running fiber still unwinds
it. VibeLang's internal abandonment signal still bypasses recovery so cleanup
cannot resume an abandoned continuation.

`retry` likewise retries a failure beside an interruption, but never a cause
containing a defect. `Effect.mapError` maps every expected failure in place and
preserves the other reasons. Code that inspects causes or depended on an
Effect recovery operator dropping a cleanup defect should be updated.

### Upgrade an existing project

Keep VibeLang packages at 0.0.10. Update Effect and its platform and test
packages together, and set the transitive peer override in `package.json`:

```json
{
  "overrides": {
    "@effect/platform-node-shared": "4.0.6"
  }
}
```

With npm:

```sh
npm install --save-exact vibelang-runtime@0.0.10 effect@4.0.6 @effect/platform-node@4.0.6
npm install --save-dev --save-exact vibelang@0.0.10 vibelang-vite@0.0.10 @effect/vitest@4.0.6
npm run build
npm test
```

With Bun:

```sh
bun add --exact vibelang-runtime@0.0.10 effect@4.0.6 @effect/platform-node@4.0.6
bun add -d --exact vibelang@0.0.10 vibelang-vite@0.0.10 @effect/vitest@4.0.6
bun run build
bun run test
```

Update only the platform and test packages your project uses; a Bun platform
project uses `@effect/platform-bun@4.0.6` instead of the Node platform.
Commit the updated lockfile. Review tests that inspect causes, recover a
failure beside interruption, or expect a cleanup defect to be dropped, using
the before/after examples above. See [Existing project](existing-project.md)
for mixed TypeScript and editor setup.

### Syntax

- The terse contract syntax is back as an alias of `Effect<A, E, R>`.
  Both spellings work in the same file; guides, the skill and the starter use
  the terse form again:

  | Terse | Means |
  | --- | --- |
  | `User!NotFound!Db` | `Effect<User, NotFound, Db>` |
  | `User!NotFound!` | `Effect<User, NotFound>`: needs nothing |
  | `User!!Db` | `Effect<User, never, Db>`: cannot fail |
  | `User!!` | `Effect<User>`: cannot fail and needs nothing |
  | `User!NotFound` on a function with a body | `Effect<User, NotFound, infer R>` |

- `Effect<User>` keeps its 0.0.8 and 0.0.9 meaning,
  `Effect<User, never, never>`. Code using the 0.0.6 shorthand compiles
  again; EK1014 is retired. Hovers and fixes show the terse form.
  EK4833 still warns only on `Effect.Effect<…>`; its fix writes the terse
  form, including `Effect.Effect<A>` and `Effect.Effect<A, E>` on a body.
  `--fix` leaves existing `Effect<…>` annotations alone.

### Resource safety

- A C-style loop head such as `for (using h = acquire(); …; …)` releases
  its resources on every exit: normal completion, jumps, return, typed failure,
  defect and interruption. Multiple head values release in reverse order.
  Effect acquisitions in the head now compile, and labeled loops preserve
  their `break` and `continue` targets.
- `for (using x of values)` disposes each element when its iteration ends,
  then closes an iterator, producer or Stream on early exit, including failure
  and interruption. Producers and Streams now run in this form; generator
  `finally` blocks that were skipped now run.
- For a JavaScript Disposable acquired with an explicit release, use the
  documented plain holder pattern: acquire `{ value: disposable }` and
  release `holder.value`. Binding the Disposable itself also invokes
  `Symbol.dispose` and can release it twice. The pending-interruption window
  between a synchronous JavaScript acquisition and registering disposal still
  exists; see [Scope](../resource-management/030-scope.md).

### Correctness

- Plain recursive call cycles start with fast JavaScript calls and continue
  on heap frames at the eager depth limit, avoiding stack overflow for deep
  recursion. Calls through synchronous callbacks and functions with a plain
  return annotation still have JavaScript's stack limit.
- `match` and `is` read their subject once, including property getters,
  optional chains and patterns that perform several tests. An arm's binding
  no longer shadows the subject before it is read. Exhaustive matches over
  discriminant properties and optional-chain subjects retain their narrowing.
- Callable Disposables are disposed in blocks and loops. Await operations
  also accept callable iterables instead of treating them as records.
  Thanks to [Vladimir Kalnitsky](https://github.com/klntsky) for contributing
  the callable resource fix.
- Checking large `data` matches and `is` chains caches tag narrowing and
  matcher resolution, avoiding cubic work. A per-body budget of 3,145,728
  uncached union members bounds pathological cases with TS2563; split an
  oversized match into smaller functions if it reaches that limit.

### Diagnostics

Changes to previously accepted code:

- A typed catch expression, `load() catch (e: NotFound) => fallback`, now
  reports EK2112, a fixed-severity **warning**. It still compiles; the
  annotation never filtered failures. Write an untyped `catch (e)` and
  test `e` with `match` or `is`, rethrowing unhandled failures.
  The editor and `vibelang --fix` can make that rewrite.
- An unused, unexported zero-argument `main` now warns with EK1016.
  Write `export function main()` to run it when the module starts.
- EK4409 now also warns when a primitive-success contract returns a call
  through `any` whose local initializer proves it returns a cold program.
  Give the callee an Effect-returning type so its call runs the program.
  With EK4409 configured as an error, previously accepted code in this case
  stops compiling until fixed. EK1016 can also be configured as an error
  in 0.0.10. Ordinary dynamic value calls keep their existing behavior.
- The data-pattern work budget above can stop a formerly accepted, oversized
  body with TS2563. Split it into smaller functions.

New explanations for code that already failed, and improved messages:

- `fork do { … }`, `uninterruptible do { … }`,
  `interruptible do { … }` and `restore do { … }` now report EK1003,
  an **error**. Remove `do`: write `fork { … }`, and likewise for the
  other direct blocks.
- EK1015 explains `yield* call()` outside a generator: remove `yield*`,
  since a VibeLang call already runs.
- EK4502 explains `call().pipe(…)` when the success value has no `pipe`
  member: use `call() |> retry(%, policy)` or `retry(call(), policy)`.
  A result with its own `pipe` member still works.
- EK4503 explains implementation member reads such as `Users.region`:
  use `Users().region` inside an Effect function. Direct
  `Users.find(id)` calls and static key members stay valid.
- TS2540 explains implicit readonly members and shows `mutable`.
  EK1001 explains a misused inferred Effect default parameter: make the
  parameter optional and compute its default in the body.
- EK4701 names a missing nested data pattern, including its field path.
  An unresolved `TestClock` name suggests
  `import { TestClock } from "effect/testing"`.
- EK4402 names each platform API's Effect replacement, named import and
  providing layer: `FileSystem` with `NodeServices.layer`,
  `HttpClient` with `FetchHttpClient.layer`, `Path.resolve()` for
  `process.cwd()`, and `FileSystem.makeTempDirectory()` for
  `os.tmpdir()`. Where Effect lacks an API, such as `os.hostname()`,
  it shows a `sync` hatch.
- EK4403 preserves units and test advice:
  `performance.now()` becomes
  `Number(Clock.monotonicTimeNanos()) / 1e6`, and `new Date()` becomes
  `DateTime.nowAsDate()`. Crypto replacements name their import and layer,
  and `TestCrypto.layer(seed)` for tests. The diagnostic configuration
  belongs in the top-level `vibelang.diagnostics` object of
  `tsconfig.json`.

### Tooling

- Completion hides compiler-written match bindings and the synthetic service
  brand. `noUnusedLocals` no longer reports compiler-written bindings.
- Watch summaries count warnings separately from errors.
- The formatter normalizes spaces after declaration keywords and preserves
  either contract spelling. The starter's documented dprint configuration
  formats its generated app.
- Typed catch fixes preserve comments, and catch rewrites omit unreachable
  default rethrow arms when the handlers cover every failure.
- `vibelang/project` resolves relative project paths from the caller's
  working directory, including compiler discovery.
- `--help` lists VibeLang's flags. The starter test command discovers its
  tests; the compiler's Go smoke suite has an explicit 20-minute timeout.
- Compiler package attribution points to the unified TypeScript upstream.

### Editor

- The VS Code and Cursor extension uses the VibeLang mark for `.vibe`
  files; packaging tests verify the icons in the VSIX.

### Docs

- Platform guidance starts with Effect's services, their imports and layers.
  Hatches illustrate APIs Effect does not cover, and complete Effect
  comparison tabs are checked as programs.
- Setup documents exact Effect pins, mixed TypeScript adoption and editing
  costs, local TypeScript and npm boundaries, supported dprint versions,
  cache startup, and current compiler limitations with executable evidence.
- Debugging guidance explains tracing, runner stacks and runtime costs.
  Token comparisons lead with measured corpus savings and identify longer
  VibeLang examples; they are not runtime performance promises.
- The shipped agent skill is self-contained. Public documentation clients
  can read the site without browser integrity checks. Repository paths,
  language names and editor setup guidance are current; retired hosted
  converter code and review scratch probes have been cleaned up.

## 0.0.9

This release has no breaking changes.

- `vibelang --fix` writes only the project's own files. It leaves workspace
  dependencies and referenced projects unchanged, while still reporting their
  diagnostics.
- When a round of fixes would add an error, `--fix` narrows down the refused
  fixes without rechecking the whole project once per file. Stopping it with
  SIGTERM exits cleanly, reports the interruption and writes no changes.
- Emitted declaration files import prelude names used in `typeof` queries
  and in inferred types copied from libraries. TypeScript consumers now
  resolve those names and retain their types.
- The register loader works with tools that read inline source maps, including
  Playwright's stack-trace support. They no longer mistake the loader's
  source map template for its own map.

## 0.0.8

0.0.7 was not published: 0.0.8 replaces it, and these notes include its changes.

### Changes that can break code since 0.0.6

- A contract is written `Effect<A, E, R>`, as in TypeScript. The shorthand
  `Result!Error!Dependencies` is retired: each use is the error EK1014,
  whose quick fix writes the Effect type it stood for. Run
  `vibelang -p tsconfig.json --fix` to rewrite a whole project:

  | 0.0.7 | 0.0.8 |
  | --- | --- |
  | `User!NotFound!Db` | `Effect<User, NotFound, Db>` |
  | `User!NotFound!` | `Effect<User, NotFound>` |
  | `User!!Db` | `Effect<User, never, Db>` |
  | `User!!` | `Effect<User>` |
  | `User!NotFound` on a function with a body | `Effect<User, NotFound, infer R>` |
  | `User!NotFound` anywhere else | `Effect<User, NotFound>` |

- A type argument left out of an Effect type means what it means in
  TypeScript: `Effect<A>` is `Effect<A, never, never>` and `Effect<A, E>`
  is `Effect<A, E, never>`. A return annotation such as `Effect<User>` on a
  function with a body was EK2003; it now checks that the function cannot
  fail and needs nothing. A service or control member may write
  `Effect<User>` or `Effect<User, NotFound>`, which EK2101 rejected.

- The starter treats EK3205 as an error: an entry module's `main` that
  needs services without providers stops the build and emits no JavaScript.
  Provide those services before running the entry program.
- Members returned by `Layer.effect(Service) { ... }` must fit the
  service's contract, as in `Layer.succeed`. EK3101 rejects a member that
  looks up services its contract does not allow at call time; failures
  outside the member's contract are EK2001.
- A recursive call whose contract leaves failures or requirements inferred
  uses the written success type in an operand or initializer. Where typing
  the call needs the whole contract, including an argument, a logical
  operand or a generic self-call, EK2102 asks for every channel instead of
  recursing through inference or reporting a circular return type.
- A `for...of` whose body runs an Effect calls its iterator's `return()`
  when the body fails or is interrupted, as it does on `break` or
  `return`. Iterator cleanup that was previously skipped now runs.
- EK4201 also rejects unhandled control operations passed by name across a
  fork, an await operation or a concurrent loop. Install the handler inside
  the new fiber, or run the operation on the current fiber.
- A comma between fields of an `error`, `schema error`, `service` or
  `control` declaration is EK1013. Separate fields with semicolons or new
  lines.

### Compiler

- A `data` declaration declares a tagged union with Effect's own
  `Data.TaggedEnum` type and its `Data.taggedEnum` constructors:
  `data Delivery { Waiting; Sent { tracking: string } }`.
  `Delivery.Sent({ tracking })` builds a value, and
  `when Delivery.Sent { let tracking }:` matches one. A `match` without
  `default` over a data type must handle every variant (EK4701). See
  [Data](../data-types/073-data.md).

- CommonJS output binds the names a file takes from the prelude, including
  `TaggedError`, bare Effect functions, `pipe` and `flow`. These names
  could previously fail with a `ReferenceError` when the module ran.
- Invalid jumps without a target, a Stream loop without a binding and
  incomplete Effect type arguments report diagnostics instead of crashing
  the compiler.
- A handler's tail `resume` inside a `for concurrent` body no longer
  reports EK4606.
- Hovering over a by-name argument no longer leaves the call inferred as
  `unknown`. The language server identifies itself as `vibelang`.

### New diagnostics

- EK1014 reports the retired contract shorthand and offers its
  `Effect<...>` replacement in the editor and through `vibelang --fix`.
- EK4833 reports only `Effect.Effect<A, E, R>`, and its fix writes
  `Effect<A, E, R>`. Hovers and messages show Effect types as `Effect<…>`.
- EK1013 names the field separator error, and its quick fix replaces the
  comma with a semicolon. Misspelled names in a `.vibe` file can suggest
  names from the prelude.
- EK1001 identifies the plain JavaScript context that cannot run a program,
  including class initializers, constructors, accessors, static blocks and
  default parameter values. EK4301's hatch suggestion includes the callback
  parameter where the call needs it.
- EK3201 explains that a program typed `any` has unknown service
  requirements. EK4401 suggests a `try` call that passes inputs into the
  hatch and the `trusted()` wrapper, and EK2003 explains that an exception inside a hatch
  becomes a defect with `sync` or an expected failure with `try`.
- With `--pretty`, a file with both TypeScript and VibeLang errors is
  counted once in the error summary.

### Starter and packages

- The starter builds standalone TypeScript sources, checks their errors and
  keeps source tests out of build output. New apps start at version
  `0.0.0`, and their README describes an installed app.
- The starter pins `@effect/platform-node-shared` to `4.0.5` so its
  transitive peer dependency agrees with Effect. Example projects install
  the published VibeLang packages and use the same platform override.
- `vibelang-vite` preserves fractional compile start timestamps when it
  compares file changes and provides compile and invalidation traces through
  `VIBELANG_VITE_DEBUG=1`.
- The release publisher skips an existing registry version only when its
  tarball checksum matches the local tarball. The internal TypeScript mapper
  is marked private.

### Docs

- The guides and packaged skill use `Effect<...>` contracts and teach
  `data` declarations and exhaustive matches.
- Setup describes npm and Bun separately, makes Bun optional for npm users
  and links TypeScript 7's removed-option migration notes. The Vite guide
  explains source checking and import extensions.
- The guides teach the current `trusted()` wrapper, the starter's provider
  check and Effect 4 APIs. They name `Cause.UnknownError`, explain that
  plain JavaScript recursion can overflow the stack, and link known
  limitations and the pending-interruption resource workaround.
- Examples omit harness directives and unexplained decision references.
  Token comparisons state the measured corpus, and agent setup starts with
  the packaged skill.
- GitHub is available from the site's top navigation on every page.

### Known limitations

- Stock `tsc`, `vue-tsc` and `svelte-check` do not check `.vibe` imports.
  The TypeScript 7.1 content mapper is experimental and unpublished, and
  does not lower `data` declarations; see
  [the current mapper limitation](known-limitations.md).
- Native Windows binaries are not available; Windows needs WSL.
- Effect remains pinned to `4.0.5` exactly. Effect `4.0.6` changes cleanup
  failure handling in a way VibeLang does not yet support; see
  [the pin's explanation](existing-project.md).
- A JavaScript Disposable acquired at the end of a masked `using`
  initializer can leak if interruption is pending before its release is
  registered. Use `Effect.acquireRelease` with protected acquisition; see
  [the safe pattern](../resource-management/030-scope.md#known-limitation-pending-interruption-and-javascript-disposables).

## 0.0.6

0.0.5 was not published: 0.0.6 replaces it, and these notes include its
changes. 0.0.4 was not published either, so from 0.0.3 read the 0.0.4 notes
too.

### Changes that can break code since 0.0.3

These fixes are included in the changes since the last published version,
0.0.3. The comparisons below describe the unreleased 0.0.4 compiler.

- An optional call of a callback without a contract, `f?.(x)`, runs the
  program the callback returns, as `f(x)` does. On 0.0.4 it returned the
  program unrun. The callback's failures and requirements now reach the
  caller's contract, so a contract that leaves them out is EK2001 or EK2002.
- A file whose functions are Effects only because they throw, produce,
  declare `using`, or call `JSON.parse`, `decodeURI` or `decodeURIComponent`
  loads effect. On 0.0.4 such a function was typed and declared plain while
  its JavaScript returned an Effect. Where effect does not resolve, each such
  function is the new error EK1011.

### Compiler

- A comment before an expression that the compiler writes after a `return`,
  `throw` or `yield` stays a comment. A `match` arm whose value follows a
  comment, or whose pattern begins with a comment on its line, as in
  `when [ // first`, returned `undefined`.
- `uninterruptible { ... }` stays uninterruptible when it declares a `using`
  resource, and releases the resource when the block ends. On 0.0.4 such a
  block compiled without its mask, and an interruption reached its
  statements.
- The compiler no longer overflows the stack on a function that passes a
  call of itself by name, as `guard(healthy(index - 1))` does. It reports
  EK2102 at the function: write its failures and requirements in its
  contract.
- The failures and requirements of a callback without a contract default to
  `never`, so a call that omits an optional callback adds none.
- A call that runs no longer takes type arguments from its contextual type,
  which types its success value, not the Effect: `return late()` under
  `Late!!`, where `late` returns a `Late` error instance, compiles.

### New warnings

None of these warnings changes the emitted JavaScript.

- EK4409: a call of an `any`-typed value is a program's value or what an
  Effect function returns. The call returns its value, so a program the callee
  returns never runs. Give the callee a type. EK4409 is adjustable, like
  EK2004.
- EK4802 also reports an Effect value in a returned conditional's arm, in an
  operand of `??` or `||`, or on the right side of `&&`. Where the success
  type names no value (`void`, `unknown`, `any`, or a type parameter the call
  infers), it reports a returned Effect value or program literal, a program
  returned by name (a `const`, field or parameter), and a returned value whose
  type is a union with an Effect value or a program among its members. Its
  quick fixes call the value to run it, or write its type as the success type
  to return it; a union with a member that is no program gets only the second.
- EK2004 also reports where a plain function's `catch` lets an exception
  through: the first call in the `try` block of an untrusted function, a
  declaration without `@throws`, or a trusted package's export whose name
  ends in `Sync` or contains `OrThrow`. A plain `catch` receives expected
  failures only; `Result.try` or a `module` block catches the exception.
- EK1012: a call that never succeeds, stored by a variable's initializer, an
  object literal's field, an array element or an assignment. The call runs
  there, so `const missing = Effect.fail(new Missing())` fails at the
  `const`. To keep the program, write a function or the declared Effect
  type. EK1012 is adjustable, like EK4409.

### Tools and integrations

- Coverage: V8 coverage tools such as `@vitest/coverage-v8` and c8 count the
  functions and statements the author wrote, not the thunks and wrappers the
  compiler adds. Stack traces and breakpoints are unchanged.
- `vibelang-vite`: a Vitest rerun recompiles a `.vibe` module after its
  imports or the compiler change. The plugin keeps `.vibe` modules out of
  Vitest's on-disk module cache.
- Formatter: a `module` block formats to itself under a dprint host without a
  TypeScript plugin, where each pass added a blank line, and a statement that
  starts with a parenthesis formats with dprint's `;` guard instead of
  failing.
- The setup page's Bun check expects Bun 1.4.0 or later again.

### Known limitations

- A returned Effect value, program literal or program named by reference
  where the success type names no value is the success value, not a program
  to run. EK4802 warns.
- A stored call that never succeeds runs where it stands. EK1012 warns.
- A JavaScript Disposable acquired in a masked section at the end of a
  `using` initializer can leak when an interruption is pending: it is delivered
  as the mask ends, before `using` registers the release. The pending
  `scopes-using-pending-interrupt` case records `["acquired"]` instead of
  `["acquired","disposed"]`. Use `Effect.acquireRelease` with its default
  protected acquisition and an explicit disposal callback, or
  `using h = Effect.acquireRelease(...)` for a lexical lifetime.
  See the [safe pattern](../resource-management/030-scope.md#known-limitation-pending-interruption-and-javascript-disposables).
- A class method annotated with a plain return type whose body runs an
  Effect keeps its plain type; called through an interface, it returns the
  Effect instead of running it.

## 0.0.4

### Changes that can break code that compiled on 0.0.3

Each one rejects, or changes, a program that compiled on 0.0.3 but ran
differently from what its types said.

- A `throw` that can escape a constructor, a getter or setter, a class
  `static` block, or a module's top level is a compile error: EK2003, or
  EK1001 at the top level. These run as plain JavaScript, so the throw ended
  the program with a defect its type said could not happen. A throw that a
  `catch` in the same code handles still compiles. Put code that must throw a
  JavaScript exception, such as a test's throwing getter, in a `module`
  declaration.
- A `match` arm that tests a class runs only for an instance of that class.
  A match that relied on a class pattern to cover a type that is neither that
  class nor a subclass of it is a compile error; on 0.0.3 it could run the
  wrong arm.
- A subclass in a schema error family that declares a `_tag` field must
  include its own name in that field's type.
- A `const` declared with an Effect type holds its initializer through
  `as`, `satisfies`, `!`, a conditional, and a pipe, as it already did through
  parentheses. The initializer runs each time the const is run, not where the
  const is declared.
- A direct `sync` or `try` of an async function passes the function exactly
  its inputs, and an `AbortSignal` only where its overload passes one. On
  0.0.3 a rest parameter received a stray `undefined` and an optional
  parameter of another type could receive the signal.
- Every package requires Node 26 or later.

### Compiler

- A plain function is called as a plain function from every import shape:
  a default import beside named or namespace imports, CommonJS output, and
  `export default f`.
- `super` and `arguments` work in Effect methods, Effect arrows, and `try`
  blocks. On 0.0.3, `super` in an Effect method emitted a module that failed
  to load.
- A bundle runs only its entry module's `main`, in ES module and CommonJS
  output, and a CommonJS file that exports `main` loads and runs it when Node
  runs the file. The compiler warns
  (EK3205) when an entry module's `main` needs services that nothing
  provides.
- `module` declarations: emitted names never collide with your names, global
  names, or the file's imports; CommonJS output keeps their re-exports; their
  declaration files use the `.vibe` file's imports.
- A schema error family's base schema encodes and decodes its subclasses.
- A non-tail `resume` has a type that covers every value its handler can end
  with.
- `using` awaits `Symbol.asyncDispose` of a value that only async-disposes.
  `sync` and `try` called as values pass an async function its `AbortSignal`.
- The compiler no longer crashes on `service X: typeof X` or on a pipe with a
  missing left operand, and the formatter no longer crashes on a file with a
  `match`.
- Lambdas and pipes keep their meaning in more places: a lambda for an
  optional member takes the member's contract; a factory lambda keeps
  TypeScript's type in a branch of a conditional argument; either arm of a
  returned conditional can make a factory; an annotated lambda can call the
  variable it initializes; a returned pipe that ends in a call returns what
  the call returns; a function literal on a pipe's left side stays a program
  for a curried stage; a pipe in an Effect-typed field keeps its function
  plain for callers.
- A `provide` block keeps `Exclude<R, I>` of a generic requirement, and a
  `for...of` over a Stream inside one no longer crashes the compiler.
- A `restore` block inside an uninterruptible expression is inside it, and a
  comment before a by-name program no longer ends its return early.
- A destructuring property name inside a hatch is not a capture.
- Declaration files: a function expression's written contract is its
  declared type, a `.vibe` file's header comment stays first, and schema
  declarations keep their comments.
- Diagnostics: a contract suggestion for a `never` success writes `never`,
  and a diagnostics comment can give its reason after punctuation.

### Tools and integrations

- The install guides install the current version and say that Windows needs
  WSL. The starter's `AGENTS.md`, `llms.txt`, and the agent skill teach the
  forms the compiler accepts.
- npm packages and the VS Code extension ship complete license and notice
  files.
- Projects: a project compiles sources above its directory; a program without
  a `tsconfig.json` checks each package's `.vibe` files with that package's
  settings; `VIBELANG_PROJECT` compiles the modules in its directory, and a
  workspace dependency's source compiles with its own `tsconfig.json`; a
  check-only project that imports `.ts` files compiles in the loaders; a root
  project compiles a nested package it reaches through `node_modules`.
- `vibelang-unplugin`: esbuild tree-shakes the `.vibe` modules of a package
  without side effects, and each entry's types import only its own bundler's
  types.

### Known limitations

- `using` does not release a value whose acquisition ends in an
  uninterruptible section when an interruption arrives during that section.
- A class method annotated with a plain return type whose body runs an
  Effect keeps its plain type; called through an interface, it returns the
  Effect instead of running it.

## 0.0.3

### Changes that can break code that compiled on 0.0.2

- `error`, `service`, and `control` declarations are classes. Error classes
  accept constructors, methods, and inheritance; each subclass has its own
  name as its tag. An error family's base can declare `_tag: string`;
  an abstract error has that tag type by default.
- `throw` always fails outside a TypeScript hatch or module. Plain functions
  and JavaScript generators cannot let a typed failure escape. Use an Effect
  contract for a function that can fail, or TypeScript for JavaScript throws.

### Language

- `schema error` declares a serializable error class. `schema Name = Type`
  declares a schema and its type; `service Name: Type` declares a service
  whose shape can be any type.
- Inline `module` declarations hold self-contained TypeScript. Import their
  exports by the module's name; diagnostics and editor navigation point into
  the body, and declaration emit writes a separate declaration file.
- Both sides of a catch expression receive its contextual type. An exhaustive
  match omits its final test. More data-first Effect functions support method
  syntax, including functions whose receiver is not named `self`.

### Tools and integrations

- Format `.vibe` with the dprint process plugin and lint it with
  `vibelang/eslint`. A tree-sitter grammar and Neovim support are available.
- TypeScript-style Effect forms warn with editor quick fixes where a
  VibeLang form preserves their meaning. `vibelang --fix` applies the fixes.
- The compiler package ships the VibeLang agent skill.
- Imported foreign-project sources use their own VibeLang settings.
  Declarations use `.js` specifiers for `.vibe` modules, and tools reuse
  successful whole-project compiles through an on-disk cache.
- `bun --preload vibelang/bun` runs and tests source modules.
  The Vite plugin's `register: true` lets child processes import `.vibe`;
  `vibelang-unplugin/deferred` loads the plugin when a bundler awaits it.

## 0.0.2

Nine published packages: `vibelang`, four native compilers
(`vibelang-{darwin,linux}-{arm64,x64}`), `vibelang-runtime`,
`vibelang-vite`, `vibelang-unplugin`, and `create-vibelang`.
`vibelang-unplugin` is new in this release. Native Windows binaries
are not available yet; use WSL and follow the Linux instructions.

### Changes that can break code that compiled on 0.0.1

Each is a compile error that names the problem; none silently changes what
compiled code does.

#### Platform globals through `globalThis` are EK4402

`process.env` was already EK4402. `globalThis.process.env`,
`globalThis.fetch`, `globalThis.crypto.subtle`, `globalThis.location`,
`globalThis.navigator`, and the other platform globals now are too.

```vibe
// expect-error: EK4402
function home() {
  return globalThis.process.env.HOME
}
```

Read configuration with `Config` from Effect:

```vibe
function homeDir() {
  return Config.String("HOME")()
}
```

Otherwise, read the global in a TypeScript module the project trusts, such as
`platformEnv.ts`:

```ts
// TypeScript (.ts)
/** @vibelang trusted */
export const processEnv = () => globalThis.process?.env
```

#### A call typed as a union of Effects runs where it stands

A call to a function that returns `Effect<A> | Effect<never, E>` now runs the
program, as `yield* decide(flag)` does in TypeScript. In 0.0.1 it silently held
the program.

```vibe
error Rejected

function decide(flag: boolean): Effect.Effect<number> | Effect.Effect<never, Rejected> {
  return flag ? Effect.succeed(1) : Effect.fail(new Rejected())
}
```

A 0.0.1 workaround that holds the program and then calls it no longer compiles:

```vibe
// expect-error: TS2349
function total(flag: boolean) {
  const held = decide(flag)
  return held() + 1
}
```

Delete the workaround and use the value:

```vibe
function total(flag: boolean) {
  const value = decide(flag)
  return value + 1
}
// number!Rejected!
```

A function annotated with a union of Effects whose branches return decided
Exits, such as `cond ? Exit.fail(e) : Exit.void`, runs the chosen Exit.

#### `Request` is the web-standard class

Web-standard globals keep their names, as JavaScript's built-ins do: `Request`,
`Response`, `Headers`, `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`,
`AbortController`, `AbortSignal`, `Blob`, `FormData`, `structuredClone`, and
`fetch`. Of Effect's root names only `Request` collides, so `Request.tagged`
without an import is now TS2339 or TS2702. Import Effect's module:

```vibe
import { Request } from "effect"

interface Lookup extends Request.Request<string> {
  _tag: "Lookup"
  id: string
}

const Lookup = Request.tagged<Lookup>("Lookup")
```

#### A `const` with a declared Effect type holds the program

`const p: Effect.Effect<A, E> = make()` keeps the program `make()` returns cold
instead of running it, at any scope. When the call returns a program that
produces a program, as `Effect.cached(...)` does, the annotation must name the
outer program, `Effect.Effect<Effect.Effect<A, E>>`, or the compiler reports
TS2322 or TS2375. To run the call, drop the annotation.

#### A throw expression can't be an operator's left operand (EK1010)

In expression position, `throw cond ? a : b` threw `cond` and discarded the
rest; it is now EK1010. Write `throw (cond ? a : b)`. A statement that starts
with `throw` is unchanged.

#### A curried pipe stage after a call keeps the call

`x |> f(args)(%)` becomes `x.pipe(f(args))` only when `x` calls nothing. When a
call builds the left side, bind it first: `const s = Schema.NullOr(Schema.String)`,
then `s |> f(args)(%)`.

### Fixes

- An Effect subtype returned at an Effect boundary runs. A value the contract's
  written success type accepts is returned as data:
  `keep(command): ChildProcess.Command!never!Scope` returns the command.
- A discarded structured Effect call is diagnosed (EK4301). A program cast and
  piped with `|>` is passed by name.
- Callback cleanup waits for async and Effect finalizers on interrupt. Copied
  declaration types import prelude names.
- A `function*` annotated `Generator<...>` stays a JavaScript generator.
- Function-valued service implementations and contract-annotated arrows keep
  their programs.
- Nested Effect function declarations hoist, so a call above the declaration
  works.
- The checker no longer overflows the stack on a shorthand discriminant property
  under a union context.
- By-name tail programs, conditional by-name arms, and optional program fields
  run as written.
- Diagnostics: inline boundary callbacks, `Effect.fn` span advice, non-adjustable
  EK option policies, and `.d.ts` JSDoc that matches tsc.

### Known issues

- A throwing local arrow with no contract, inside a function with a plain return
  annotation, reports EK2003 on the outer annotation. Annotate the local arrow,
  such as `(value: number): void => { ... }`.
- EK4802 can warn on a local annotated `Effect<Effect<...>>` that returns its
  program unrun. The emitted code is correct.
- Programs that by-name lowering wraps spend extra Effect operations.
- A recursive `Schema.Class` whose `Schema.suspend` callback writes an Effect
  contract, `(): Schema.Codec<Crate, CrateWire>!! => Crate`, reports TS2506 and
  TS2740. Annotate the plain return type instead,
  `(): Schema.Codec<Crate, CrateWire> => Crate`. Both compile to the same
  JavaScript.
