// Stands in for @types/node, a platform package (its package.json names it), whose globals are platform APIs.
export {}
declare global {
  var process: { pid: number; cwd(): string; env: Record<string, string | undefined> }
  var Buffer: { from(text: string): Uint8Array }
  var require: { (id: string): unknown; resolve(id: string): string }
  var __dirname: string
}
