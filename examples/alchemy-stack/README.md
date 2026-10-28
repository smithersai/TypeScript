# Alchemy stack

An [Alchemy](https://alchemy.run) 2.0.0-beta.84 stack: an R2 bucket of notes
and a Cloudflare Worker that stores (`PUT /key`) and serves (`GET /key`)
them, answering 404 for a missing note. `src/` is the VibeLang version;
`ts/` is the same stack in Effect TypeScript.

From this directory, with `vibelang` on `PATH`:

```sh
bun install
bun run test   # type check and Vitest; deploys nothing
```

`test/api.test.ts` runs one suite against both versions. It provides the
Worker's `Cloudflare.R2.ReadWriteBucket` binding with an in-memory bucket and
sends requests through `HttpServerRequest.fromClientRequest`, so it needs no
Cloudflare account, credentials or network. `Cloudflare.R2.Bucket` declares a
resource, which reads Alchemy's `Stack` service; the test provides an empty
one.

The example never runs `alchemy plan` or `alchemy deploy`: both need a
Cloudflare profile, and `plan` reads the account even for an empty state.

[pairs/](pairs/) holds real before-and-after code from the Alchemy migration.
