/// <reference path="./types-node/index.d.ts" />
/** A .ts file keeps every global. @vibelang trusted */
export function hostOf(): string {
  return process.env.HOST ?? "localhost"
}
