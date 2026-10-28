package vibelangmapper

import (
	"strings"
	"testing"
)

func TestEffectContractHasNoPlainMember(t *testing.T) {
	for _, source := range []string{
		`export function f(n: number): number!! { return n }`,
		`export function f(n: number): Effect.Effect<number> { return n }`,
		`function f(n: number): number!! { return n }; export { f }`,
	} {
		p := Project(source, testContext)
		if strings.Contains(p.Text, "const $plain:") {
			t.Fatalf("Effect contract gained a required plain member: %s", p.Text)
		}
	}
}
