export type Text = string
export const text = (value: string): Text => value
export const count = (texts: ReadonlyArray<Text>): number => texts.length
