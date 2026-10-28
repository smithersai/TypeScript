// Types for the TypeScript files that import steps.mjs (flow.ts).
export interface Outcome {
  readonly step: string
  readonly batch: string
  readonly summary: string
}
export declare function flowStep(step: string, options: Record<string, unknown>): Promise<Outcome>
