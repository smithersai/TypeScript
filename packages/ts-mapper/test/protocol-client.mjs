// Bounded JSON-RPC transport shared by the real mapper and stock TypeScript LSP.
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { pathToFileURL } from "node:url"

export function client(binary, args, cwd) {
  const child = spawn(binary, args, { cwd, stdio: ["pipe", "pipe", "pipe"] })
  let buffer = Buffer.alloc(0), stderr = "", nextId = 0, stopped = false
  const pending = new Map()
  const log = () => `${binary}: pending ${[...pending.values()].map(p => p.method).join(", ")}\n${stderr}`
  function fail(error) {
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error) }
    pending.clear()
  }
  function send(message) {
    const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...message }))
    child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`)
    child.stdin.write(body)
  }
  child.stderr.on("data", chunk => { stderr = (stderr + chunk).slice(-12000) })
  child.on("error", error => { stopped = true; fail(error) })
  child.stdin.on("error", fail)
  child.on("close", (code, signal) => { stopped = true; fail(new Error(`RPC exited ${code}/${signal}: ${log()}`)) })
  child.stdout.on("data", chunk => {
    try {
      buffer = Buffer.concat([buffer, chunk])
      assert.ok(buffer.length <= 8 << 20, "RPC frame exceeds 8 MiB")
      for (;;) {
        const end = buffer.indexOf("\r\n\r\n")
        if (end < 0) return
        const match = /Content-Length: (\d+)/i.exec(buffer.subarray(0, end).toString())
        assert.ok(match, "missing RPC Content-Length")
        const length = Number(match[1])
        if (buffer.length < end + 4 + length) return
        const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString())
        buffer = buffer.subarray(end + 4 + length)
        if (message.method && message.id !== undefined) {
          send({ id: message.id, result: message.method === "workspace/configuration"
            ? message.params.items.map(() => null) : null })
        } else if (pending.has(message.id)) {
          const p = pending.get(message.id)
          pending.delete(message.id); clearTimeout(p.timer)
          if (message.error) p.reject(new Error(`${p.method}: ${JSON.stringify(message.error)}\n${log()}`))
          else p.resolve(message.result)
        }
      }
    } catch (error) { fail(error); child.kill() }
  })
  return {
    log,
    notify: (method, params) => send({ method, params }),
    request(method, params) {
      if (stopped) return Promise.reject(new Error(`RPC already exited: ${log()}`))
      return new Promise((resolve, reject) => {
        const id = ++nextId
        const timer = setTimeout(() => { fail(new Error(`RPC timeout at ${method}: ${log()}`)); child.kill() }, 30000)
        pending.set(id, { resolve, reject, timer, method })
        send({ id, method, params })
      })
    },
    async close() {
      if (stopped) return
      const closed = new Promise(resolve => child.once("close", resolve))
      child.kill()
      const timer = setTimeout(() => child.kill("SIGKILL"), 1000)
      await closed
      clearTimeout(timer)
    }
  }
}

// Explicitly cross the protocol's UTF-8 and LSP's UTF-16 coordinate spaces.
export function position(text, byteOffset) {
  const bytes = Buffer.from(text), prefix = bytes.subarray(0, byteOffset).toString()
  assert.deepEqual(Buffer.from(prefix), bytes.subarray(0, byteOffset), "offset splits a UTF-8 code point")
  const lines = prefix.split("\n")
  return { line: lines.length - 1, character: lines.at(-1).length }
}

export function offset(text, point) {
  const lines = text.split("\n")
  assert.ok(point.line >= 0 && point.line < lines.length, "LSP line outside source")
  assert.ok(point.character >= 0 && point.character <= lines[point.line].length, "LSP column outside source")
  return Buffer.byteLength(lines.slice(0, point.line).map(line => line + "\n").join("") +
    lines[point.line].slice(0, point.character))
}

export async function languageServer(binary, root) {
  const rpc = client(binary, ["--lsp", "--stdio"], root)
  try {
    const uri = pathToFileURL(root).href
    const result = await rpc.request("initialize", { processId: process.pid, rootUri: uri,
      workspaceFolders: [{ uri, name: "M1" }], initializationOptions: { runExternalCode: true },
      capabilities: { general: { positionEncodings: ["utf-16"] }, workspace: { configuration: true },
        textDocument: { diagnostic: { dynamicRegistration: true }, rename: { prepareSupport: true } } } })
    assert.equal(result.capabilities.positionEncoding || "utf-16", "utf-16")
    rpc.notify("initialized", {})
    return rpc
  } catch (error) { await rpc.close(); throw error }
}
