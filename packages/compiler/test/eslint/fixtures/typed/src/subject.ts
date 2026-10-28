import { count, shelf, size, text, type Shelf, type Text } from "./vibeBarrel.ts"

const lengthOf = (value: Text): number => value.length
export const first = (texts: ReadonlyArray<Text>): number => lengthOf(texts[0]!)
export const total = (texts: ReadonlyArray<Text>): string => `${count(texts)} of ${text("x")}`
export const titles = (value: Shelf): ReadonlyArray<Text> => value.titles
export const made = (texts: ReadonlyArray<Text>): number => size(shelf(texts))
// A real finding: size returns a number already.
export const sized = (value: Shelf): number => size(value) as number
