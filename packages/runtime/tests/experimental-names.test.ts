import { expect, test } from "bun:test"

// The experimental platform modules sit beside Effect's platform packages, and
// a program often imports from both, so no export of one has the name of an
// export of the other: EK4402 and the docs name each layer without saying
// whose it is (D313).
for (const platform of ["node", "bun", "browser"] as const) {
  test(`experimental names: vibelang-runtime/experimental/platform-${platform} shares no export name with @effect/platform-${platform}`, async () => {
    const experimental = Object.keys(await import(`vibelang-runtime/experimental/platform-${platform}`))
    const effect = new Set(Object.keys(await import(`@effect/platform-${platform}`)))
    expect(experimental.length).toBeGreaterThan(0)
    expect(experimental.filter((name) => effect.has(name))).toEqual([])
    expect(experimental.filter((name) => !name.startsWith("Experimental"))).toEqual([])
  })
}
