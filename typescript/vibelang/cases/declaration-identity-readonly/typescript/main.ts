export type Info = Readonly<{
  path: ReadonlyArray<string>
  label?: string
  [key: string]: unknown
}>

export type Nested = Readonly<{ inner: { readonly count: number } }>

export type Pair = Readonly<{ left: number; right: number }>
