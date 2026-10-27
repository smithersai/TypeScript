package vibelang

import (
	"strings"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/astnav"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// A module that two of effect's subpath packages list is not in scope
// (D310, rule 3): TS2304 on its name says which packages list it, so the
// program imports the one it means.
func init() { checker.RegisterDiagnosticsFilterHook(explainMissingEffectName) }

func explainMissingEffectName(c *checker.Checker, file *ast.SourceFile, all []*ast.Diagnostic) []*ast.Diagnostic {
	if !isVibeLangFile(file) {
		return all
	}
	for i, d := range all {
		if d.Source() != "" || d.Code() != 2304 {
			continue
		}
		name := astnav.GetTokenAtPosition(file, d.Pos())
		if name == nil || !ast.IsIdentifier(name) {
			continue
		}
		if packages := effectSubpathShared[name.Text()]; len(packages) > 0 {
			imports := make([]string, len(packages))
			for j, p := range packages {
				imports[j] = "import { " + name.Text() + " } from \"" + p + "\""
			}
			all[i] = note(d.Clone(), "{0} is a module of {1}, so it is not in scope without an import; add one of: {2}.", name.Text(), strings.Join(packages, " and "), strings.Join(imports, "; "))
		}
	}
	return all
}
