# Experimental platform APIs

VibeLang adds the few platform APIs that Effect does not have yet. They are experimental: a release can change or remove them. Each one extends the Effect service of the same name, so the rest of the service is Effect's own, and each will go when Effect ships the API.

| Service | Adds | Layers |
| --- | --- | --- |
| `Experimental.FileSystem` | `access(path, { executable })`, `open(path, { nonBlocking })`, `File.chmod` | Node, Bun |
| `Experimental.Crypto` | `hmac`, `sign`, `verify` | Node, Bun, browser |

`Experimental` is in scope in every `.vibe` file without an import, as Effect's modules are. A local declaration or an import named `Experimental` shadows it. TypeScript imports the same modules from `vibelang-runtime/experimental`, or one module from its subpath, such as `vibelang-runtime/experimental/FileSystem`.

## How they work

Each experimental service has its own key, `Experimental.FileSystem.FileSystem`, and its interface is Effect's plus the new members. Call it as you call Effect's service. Import the service by name from its subpath, and the import shadows the prelude's `FileSystem`: `FileSystem.access(path, { executable: true })`. Without the import, the same call is `Experimental.FileSystem.access(path, { executable: true })`.

Provide a platform layer in `main`. The layers live beside Effect's platform packages and provide the experimental service and Effect's service of the same name from one implementation, so code that uses Effect's `FileSystem` and code that uses the additions share it:

| Module | Layers |
| --- | --- |
| `vibelang-runtime/experimental/platform-node` | `NodeServices.layer`: `@effect/platform-node`'s bundle plus every experimental service; `NodeFileSystem.layer`; `NodeCrypto.layer` |
| `vibelang-runtime/experimental/platform-bun` | `BunServices.layer`, `BunFileSystem.layer`, `BunCrypto.layer` |
| `vibelang-runtime/experimental/platform-browser` | `BrowserCrypto.layer` |

The runtime lists `@effect/platform-node`, `@effect/platform-bun` and `@effect/platform-browser` as optional peer dependencies: install the one your program runs on. Failures are Effect's `PlatformError`, as for Effect's services.

## FileSystem

| Member | What it does | Node.js |
| --- | --- | --- |
| `access(path, { executable: true })` | Checks that the caller may run the file; on Windows, only that it exists | `fs.access(path, X_OK)` |
| `open(path, { nonBlocking: true })` | Opens a FIFO or a device without waiting for the other end; Windows fails with `BadArgument` | `O_NONBLOCK` |
| `file.chmod(mode)` | Changes the permissions of the file the handle opened, even after its path was renamed or replaced | `FileHandle.chmod` |

```vibe
// run: provide NodeServices.layer { Console.log(JSON.stringify(runnable())) }
import { FileSystem } from "vibelang-runtime/experimental/FileSystem"
import { NodeServices } from "vibelang-runtime/experimental/platform-node"

function canRun(path: string) {
  FileSystem.access(path, { executable: true })
  return true
}

function runnable() {
  using dir = FileSystem.makeTempDirectoryScoped()
  FileSystem.writeFileString(`${dir}/build.sh`, "#!/bin/sh")
  FileSystem.chmod(`${dir}/build.sh`, 0o755)
  FileSystem.writeFileString(`${dir}/notes.txt`, "")
  return { script: canRun(`${dir}/build.sh`) catch false, notes: canRun(`${dir}/notes.txt`) catch false }
}
// Output: {"script":true,"notes":false}
```

`lstat`, which reads a symbolic link itself, is Effect's own since Effect 4.0.6, so it needs no experimental service.

`noFollow` with `nonBlocking` opens a path that another process may replace: the open fails on a symbolic link and returns at once on a FIFO, and `file.chmod` then changes the file that was opened, not whatever the path names later.

```vibe
import { FileSystem } from "vibelang-runtime/experimental/FileSystem"

function restrict(path: string) {
  using file = FileSystem.open(path, { flag: "r+", noFollow: true, nonBlocking: true })
  file.chmod(0o600)
}
```

In tests, `Experimental.FileSystem.layerNoop({ ... })` provides a stub for both keys: Effect's `FileSystem.layerNoop`, with `open` failing with `NotFound` unless you give it.

## Crypto

| Member | What it does |
| --- | --- |
| `hmac(algorithm, key, data)` | The HMAC of `data` with a `"SHA-1"`, `"SHA-256"`, `"SHA-384"` or `"SHA-512"` digest; `key` is the raw secret, `Redacted<Uint8Array>` |
| `sign(algorithm, privateKey, data)` | Signs `data`; `privateKey` is a PKCS#8 DER key, `Redacted<Uint8Array>` |
| `verify(algorithm, publicKey, signature, data)` | `true` when `signature` signs `data`; `publicKey` is an SPKI DER key |

The signature algorithms are `"ECDSA-P256-SHA256"`, whose signatures are 64 bytes, r then s, as WebCrypto writes them, and `"Ed25519"`. A key of the wrong kind fails with `BadArgument`, whose message names no key bytes. Secret keys are `Redacted`, so logs and errors print `<redacted>`. One WebCrypto implementation serves every platform.

```vibe
// run: provide NodeServices.layer { Console.log(signature(Redacted.make(new TextEncoder().encode("Jefe")), "what do ya want for nothing?")) }
import { Crypto } from "vibelang-runtime/experimental/Crypto"
import { NodeServices } from "vibelang-runtime/experimental/platform-node"
import { Hex } from "effect/encoding"

function signature(secret: Redacted.Redacted<Uint8Array>, body: string) {
  return Hex.encode(Crypto.hmac("SHA-256", secret, new TextEncoder().encode(body)))
}
// Output: 5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843
```

`Experimental.Crypto.layerTest()` provides both keys for tests: random bytes are zeros, so UUIDs repeat, and digests, HMACs and signatures are real.

## When Effect ships them

Each addition has a matching change prepared for Effect. When an Effect release has the member, the experimental module re-exports Effect's, and a later VibeLang release removes the module (D313).
