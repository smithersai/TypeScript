// Types for the TypeScript files that import args.mjs (run.ts).
export type Options = Record<string, string | boolean | Array<string | boolean>>
export declare function parseArgs(argv: ReadonlyArray<string>): { step: string; options: Options }
export declare function many(value: Options[string] | undefined): Array<string | boolean>
export declare function one(options: Options, key: string): string
