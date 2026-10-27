package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"strconv"
	"strings"
)

const diagnosticListLimit = 10

func diagnosticListText(names []string, separator string) string {
	if len(names) <= diagnosticListLimit {
		return strings.Join(names, separator)
	}
	return strings.Join(names[:diagnosticListLimit], separator) + " (" + strconv.Itoa(len(names)-diagnosticListLimit) + " more)"
}

func diagnosticUnionText(c *checker.Checker, t *checker.Type) string {
	if t.Flags()&checker.TypeFlagsUnion == 0 || len(t.Types()) <= diagnosticListLimit {
		return c.TypeToString(t)
	}
	names := make([]string, len(t.Types()))
	for i, member := range t.Types() {
		names[i] = c.TypeToString(member)
	}
	return diagnosticListText(names, " | ")
}
