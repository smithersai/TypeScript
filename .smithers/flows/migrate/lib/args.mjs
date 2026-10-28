// Command-line arguments: `<step> --key value --flag --key value2`. A repeated
// key collects every value in order; a key with no value is true.
export function parseArgs(argv) {
  const [step, ...rest] = argv
  const options = {}
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (!arg.startsWith("--")) throw new Error(`unexpected argument ${arg}: options are --name value`)
    const eq = arg.indexOf("=")
    const key = eq > 0 ? arg.slice(2, eq) : arg.slice(2)
    let value = true
    if (eq > 0) value = arg.slice(eq + 1)
    else if (i + 1 < rest.length && !rest[i + 1].startsWith("--")) value = rest[++i]
    if (key in options) options[key] = [].concat(options[key], value)
    else options[key] = value
  }
  return { step, options }
}

/** The values of a key that may be given once or many times. */
export const many = (value) => (value === undefined ? [] : [].concat(value))

/** One required string option. */
export function one(options, key) {
  const value = options[key]
  if (value === undefined || value === true) throw new Error(`--${key} <value> is required`)
  if (Array.isArray(value)) throw new Error(`--${key} is given more than once`)
  return value
}
