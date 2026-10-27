package vibelang

import (
	"strconv"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// Hygiene. The lowering introduces names of its own: a plain function's
// variants (double$direct, double$recur, double$stack, double$eager), the
// names that show a function's name on its regions' generators (work$try),
// and the private names of declaration files (Users_base). A generated name
// must neither capture a reference the source wrote nor be captured by a
// binding the source declares, in any scope of the file. Source code may
// spell a generated name (const answer$direct = 9 is an ordinary const), so a
// generated name is never its base by right: it is fresh, spelled by no
// identifier of the source file. The lowering's references to it are written
// with the same name, so a source binding cannot capture them either.

// freshNames gives the bindings the lowering introduces in one file their
// names (freshName).
type freshNames struct {
	file  *ast.SourceFile
	given map[string]string // base -> the name it was given
	taken map[string]bool   // the names given
}

// freshName returns the name of the binding that base names: base when no
// identifier of the source file is spelled so, else the first of base$1,
// base$2, ... that none is and that no other base was given. A base names one
// role of one source name, such as double$direct, so every request for it
// gets the same name: the declaration of the variant and each reference to
// it. Two functions of one name in different scopes share their variants'
// names, which shadow one another exactly as the functions' names do. The $
// keeps these names apart from the names the printer generates later, which
// add _1, _2, ...
func (n *freshNames) freshName(base string) string {
	if name, ok := n.given[base]; ok {
		return name
	}
	if n.given == nil {
		n.given, n.taken = map[string]string{}, map[string]bool{}
	}
	name := base
	for i := 1; n.spelled(name) || n.taken[name]; i++ {
		name = base + "$" + strconv.Itoa(i)
	}
	n.given[base] = name
	n.taken[name] = true
	return name
}

// spelled reports whether an identifier of the source file is spelled name.
func (n *freshNames) spelled(name string) bool {
	return n.file != nil && n.file.HasIdentifier(name)
}

// freshName returns the name of the binding that base names in the file being
// lowered (freshNames.freshName).
func (tx *lowering) freshName(base string) string {
	return tx.fresh.freshName(base)
}

// directName returns the name of the $direct variant of the plain function
// that name, a source name, refers to in the file being lowered: a function
// the file declares or the local name of an import of one.
func (tx *lowering) directName(name string) string {
	return tx.freshName(name + "$direct")
}

// variantExportName returns the name under which a module whose exports are
// exports exports the $direct variant of its export named name: name$direct,
// or, when the module exports a name of its own spelled so, the first of
// name$direct$1, name$direct$2, ... that it does not. An importer reads the
// variant under the name it computes from the same module's exports.
func variantExportName(exports map[string]bool, name string) string {
	base := name + "$direct"
	variant := base
	for i := 1; exports[variant]; i++ {
		variant = base + "$" + strconv.Itoa(i)
	}
	return variant
}

// moduleExportNames returns the names that module, a module symbol, exports,
// or nil when module is nil.
func moduleExportNames(c *checker.Checker, module *ast.Symbol) map[string]bool {
	if module == nil {
		return nil
	}
	names := map[string]bool{}
	for _, export := range c.GetExportsOfModule(module) {
		names[export.Name()] = true
	}
	return names
}
