package vibelang

import (
	"strings"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/astnav"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// A name that is not in scope gets TypeScript's "Did you mean" (TS2552). In
// .vibe code the platform globals that EK4402 removes from scope are never
// that suggestion: Process would suggest process, which EK4402 then bans.
// A name of an experimental service (D313) that is not in scope, such as
// Process, gets a note naming Experimental.Process instead.
//
//	Process.hostname()   // TS2304, noting Experimental.Process.hostname()
func init() {
	checker.RegisterSpellingSuggestionFilterHook(suggestsNoPlatformGlobal)
	checker.RegisterDiagnosticsFilterHook(explainExperimentalName)
}

// suggestsNoPlatformGlobal is the checker's spelling suggestion filter: in
// .vibe code outside a hatch or a module block, where EK4402 applies, a
// platform global (platformGlobals) is never suggested. A declaration of
// the program's own with such a name may be.
func suggestsNoPlatformGlobal(c *checker.Checker, location *ast.Node, candidate *ast.Symbol) bool {
	name := candidate.Name()
	if _, ok := platformGlobals[name]; !ok {
		return true
	}
	if !isVibeLangFile(ast.GetSourceFileOfNode(location)) || inHatch(location) || inModuleBlock(location) {
		return true
	}
	return c.GlobalSymbol(name, candidate.Flags()) != candidate
}

// inModuleBlock reports whether node is in a module declaration's body,
// which is TypeScript (D283).
func inModuleBlock(node *ast.Node) bool {
	for n := node.Parent; n != nil; n = n.Parent {
		if n.Kind == ast.KindModuleDeclaration {
			return true
		}
	}
	return false
}

// explainExperimentalName adds a note to TS2304 and TS2552 at a name that
// one of VibeLang's experimental services has (D313), which is in scope only
// as a member of Experimental: Process.hostname() names
// Experimental.Process.hostname().
func explainExperimentalName(c *checker.Checker, file *ast.SourceFile, all []*ast.Diagnostic) []*ast.Diagnostic {
	if !isVibeLangFile(file) {
		return all
	}
	for i, d := range all {
		if d.Source() != "" || (d.Code() != 2304 && d.Code() != 2552) {
			continue
		}
		name := astnav.GetTokenAtPosition(file, d.Pos())
		if name == nil || !ast.IsIdentifier(name) || isMemberNameOf(name) || inHatch(name) || inModuleBlock(name) {
			continue
		}
		if _, ok := platformServices["Experimental"+name.Text()]; !ok {
			continue
		}
		// The written use, with Experimental. in front: the call or access
		// that name starts, Process.hostname() or Process.pid.
		use := name
		for use.Parent != nil && (ast.IsPropertyAccessExpression(use.Parent) && use.Parent.Expression() == use || ast.IsCallExpression(use.Parent) && use.Parent.Expression() == use) {
			use = use.Parent
		}
		written := strings.TrimSpace(nodeText(file, use))
		all[i] = note(d.Clone(), "{0} is VibeLang's experimental {0} service, in scope as Experimental.{0}: write Experimental.{1}.", name.Text(), written)
	}
	return all
}
