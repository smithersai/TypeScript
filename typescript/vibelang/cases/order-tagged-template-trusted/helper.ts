export class Bad extends Error {}

/** @vibelang trusted
 * @throws {Bad}
 */
export function tag(strings: TemplateStringsArray, ...values: number[]): string {
  if (values[0] === 0) throw new Bad("zero")
  return strings.join(String(values[0]))
}
