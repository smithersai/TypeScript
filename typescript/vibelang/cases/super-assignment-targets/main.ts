import { Effect } from "effect"
import { Parent, trace } from "./base.vibe"
import { Child } from "./child.vibe"
import { Child as Native } from "./reference.ts"

const forms = ["update", "computed", "post", "pre", "computedPost", "computedAdd", "computedPower", "computedNullish", "computedOr", "computedAnd", "destructure", "destructureObject", "destructureDefault", "forOf", "tagged", "bigint", "staticPost", "arrow", "field"] as const

// Each form's value and what the accessors recorded, run once.
function run(make: () => unknown) {
  trace.length = 0
  Parent.counterValue = 0
  let value: unknown
  try {
    value = make()
  } catch (error) {
    value = String(error)
  }
  return JSON.stringify([value, trace])
}

function call(target: any, form: string) {
  if (form === "arrow") return target.arrow()()
  if (form === "field") return target.field()
  return target[form]()
}

for (const form of forms) {
  const got = run(() => Effect.runSync(call(form === "staticPost" ? Child : new Child(), form)))
  const want = run(() => call(form === "staticPost" ? Native : new Native(), form))
  console.log(form, got === want ? got : `${got} (native: ${want})`)
}
