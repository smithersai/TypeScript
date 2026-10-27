// TypeScript functions that throw the .vibe file's own error class: one
// wrapped with trusted, one with a legacy trusted declaration.
import { Bad } from "./main.vibe"

export function parse(text: string): number {
  if (text === "") throw new Bad()
  return text.length
}

/** @vibelang trusted @throws {Bad} */
export function parseDeclared(text: string): number {
  if (text === "") throw new Bad()
  return text.length
}
