import { Effect } from "effect"
import { both, direct, nested, reasons, report } from "./plain.vibe"

function shown(value: unknown): string {
  if (value instanceof SuppressedError) return `SuppressedError(${shown(value.error)}, ${shown(value.suppressed)})`
  return value instanceof Error ? value.message.split("'")[1] ?? value.message : String(value)
}

// A TypeScript caller of a plain function sees the SuppressedError itself.
for (const call of [both, nested]) {
  try {
    call()
    console.log("returned")
  } catch (e) {
    console.log(shown(e))
  }
}
// The Effect form fails with both reasons.
console.log(reasons(Effect.runSyncExit(direct())))
console.log(JSON.stringify(Effect.runSync(report())))
