import { shelf, type Shelf } from "@typed/lib/Library"
import { titleOf, type Title } from "@typed/lib/Title"

const lengthOf = (value: Title): number => value.length
export const first = (value: Shelf): number => lengthOf(value.titles[0]!)
export const named = (names: ReadonlyArray<string>): string => `${shelf(names).titles.length} ${titleOf("x")}`
