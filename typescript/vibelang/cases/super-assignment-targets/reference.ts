// child.vibe's forms, as JavaScript runs them without an Effect.
import { Parent, trace } from "./base.vibe"

const key = () => {
  trace.push("key")
  return "count" as const
}
const rhs = () => {
  trace.push("rhs")
  return 2
}

export class Child extends Parent {
  keyMethod() { return key() }
  rhsMethod() { return rhs() }
  update() { super.count++; return this.value }
  computed() { super[this.keyMethod()] += this.rhsMethod(); return this.value }
  post() { const r = super.count++; return [r, this.value] }
  pre() { const r = --super.count; return [r, this.value] }
  computedPost() { const r = super[key()]++; return [r, this.value] }
  computedAdd() { const r = super[key()] += rhs(); return [r, this.value] }
  computedPower() { const r = super[key()] **= rhs(); return [r, this.value] }
  computedNullish() { const r = super[key()] ??= rhs(); return [r, this.value] }
  computedOr() { this.value = 0; const r = super[key()] ||= rhs(); return [r, this.value] }
  computedAnd() { const r = super[key()] &&= rhs(); return [r, this.value] }
  destructure() { [super.count, super[key()]] = [7, 8]; return [this.value] }
  destructureObject() { ({ x: super.count } = { x: 9 }); return [this.value] }
  destructureDefault() { [super.count = 5] = []; return [this.value] }
  forOf() { const seen: number[] = []; for (super.count of [1, 2]) seen.push(this.value); return seen }
  tagged() { return [super.tag`a${1}b`] }
  bigint() { const r = super.big++; return [String(r), String(this.bigValue)] }
  static staticPost() { const r = super.counter++; return [r, Parent.counterValue] }
  arrow() { return () => { const r = super.count++; return [r, this.value] } }
  field = () => { const r = super.count--; return [r, this.value] }
}
