import { count, text, type Text } from "./plainBarrel.ts"

const lengthOf = (value: Text): number => value.length
export const first = (texts: ReadonlyArray<Text>): number => lengthOf(texts[0]!)
export const total = (texts: ReadonlyArray<Text>): string => `${count(texts)} of ${text("x")}`
