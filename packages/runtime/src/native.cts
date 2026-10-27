// Keep both requires visible to bundlers, and ordered at native module load.
// This bridge needs no Node type declarations in compiler/mapper fixtures.
declare const require: (id: string) => unknown
require("./version.js")
const abi = require("./index.js") as typeof import("./index.js")
export = abi
