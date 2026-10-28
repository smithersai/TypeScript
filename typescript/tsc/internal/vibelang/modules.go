package vibelang

import (
	"strings"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"github.com/microsoft/TypeScript/tsc/internal/compiler"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/parser"
	"github.com/microsoft/TypeScript/tsc/internal/printer"
	"github.com/microsoft/TypeScript/tsc/internal/scanner"
)

// Module declarations (D283).
//
//	module text {
//	  export function clean(value: string): string { return value.trim() }
//	}
//	import { clean } from text
//
// The parser gives each module declaration's body a TypeScript source file
// of its own, beside the .vibe file and with its positions
// (parser/vibelang_modules.go), and the program resolves `from text` to it.
// The body is therefore checked as any .ts file is, and the .vibe file sees
// it only through its imports.
//
// Each body the file imports is a JavaScript module of its own (D403),
// main.vibe.text.js beside main.js, which main.js imports where the source
// wrote `from text`:
//
//	import { clean } from "./main.vibe.text.js"
//
// so ECMAScript orders its evaluation among the file's imports and keeps its
// exports live bindings (D364). A module that the file never imports, or
// imports only types from, emits no JavaScript, as TypeScript elides such an
// import of a .ts file (moduleEmitsScript). The module's declarations are its
// own declaration file, main.vibe.text.d.ts, which the .vibe file's
// declarations import as ./main.vibe.text.js.

func init() {
	fileChecks = append(fileChecks, checkModuleDeclarations)
	typeScriptFileChecks = append(typeScriptFileChecks, checkModuleBody)
	compiler.RegisterEmbeddedModuleScriptHook(moduleEmitsScript)
}

// checkModuleDeclarations reports misplaced and misspelled module
// declarations (EK4408) and module specifiers that name no module
// declaration of file (EK4407).
func checkModuleDeclarations(c *checker.Checker, file *ast.SourceFile) {
	seen := map[string]bool{}
	var visit func(node *ast.Node) bool
	visit = func(node *ast.Node) bool {
		switch {
		case parser.IsVibeLangModuleDeclaration(node):
			// TypeScript's own checks read the node as a namespace declared with module.
			cover(c, node)
			name := node.Name().Text()
			if name == "" {
				// module { }: the name's place, after the keyword, is empty.
				keyword := core.NewTextRange(node.Name().Pos()-len("module"), node.Name().Pos())
				reportAt(c, file, keyword, EK4408.With("A module declaration needs a name: module name { … }."))
				return false
			}
			key := strings.ToLower(name)
			switch {
			case node.Parent != file.AsNode():
				report(c, node.Name(), EK4408.With("A module declaration stands at the top level of a file."))
			case node.Modifiers() != nil && len(node.Modifiers().Nodes) != 0:
				report(c, node.Modifiers().Nodes[0], EK4408.With("A module declaration is not exported; export what it exports with export { … } from {0}."), name)
			case seen[key]:
				report(c, node.Name(), EK4408.With("This file already declares a module named {0}."), name)
			}
			seen[key] = true
			if symbol := c.ResolveName(name, node, ast.SymbolFlagsValue, true); symbol != nil &&
				c.GetSymbolFlags(symbol)&ast.SymbolFlagsValue != 0 && c.GetTypeOnlyAliasDeclaration(symbol) == nil {
				// Unused modules with a colliding value already run correctly. Report
				// the collision without rejecting those programs (D303).
				collision := EK4408.With("A module named {0} shares its name with a value binding of this file; use a distinct module name.")
				collision.Category = warningCategory
				report(c, node.Name(), collision, name)
			}
			return false
		case node.Kind == ast.KindModuleDeclaration && node.AsModuleDeclaration().Keyword == ast.KindModuleKeyword && node.Name() != nil && ast.IsIdentifier(node.Name()):
			// declare module x { }, module a.b { }: in a .vibe file module is never a namespace.
			cover(c, node.Name())
			report(c, node.Name(), EK4408.With("In a .vibe file, module declares a module whose body is TypeScript: module {0} { … }. Write a namespace with namespace."), node.Name().Text())
			return false
		case parser.IsVibeLangModuleReference(node) && file.EmbeddedModuleBySpecifier(node.Text()) == nil:
			cover(c, node)
			report(c, node, EK4407, specifierName(file, node))
			return false
		}
		node.ForEachChild(visit)
		return false
	}
	file.AsNode().ForEachChild(visit)
}

// specifierName returns the identifier a module reference was written as.
func specifierName(file *ast.SourceFile, reference *ast.Node) string {
	return file.Text()[scanner.SkipTrivia(file.Text(), reference.Pos()):reference.End()]
}

// checkModuleBody reports what a module declaration's body cannot hold
// (EK4408): it is an ES module, as TC39's module declarations are. Where
// TypeScript emits ES modules it reports export = and import = require()
// itself (TS1203, TS1202); EK4408 covers a CommonJS emit.
func checkModuleBody(c *checker.Checker, file *ast.SourceFile) {
	if file.EmbeddedModule() == nil {
		return
	}
	kind := c.CompilerOptions().GetEmitModuleKind()
	if kind >= core.ModuleKindES2015 && kind != core.ModuleKindPreserve && c.Program().GetImpliedNodeFormatForEmit(file) != core.ModuleKindCommonJS {
		return
	}
	for _, statement := range file.Statements.Nodes {
		var text string
		switch {
		case ast.IsExportAssignment(statement) && statement.AsExportAssignment().IsExportEquals:
			text = "A module declaration's body is an ES module, which export = cannot end; use export default."
		case ast.IsImportEqualsDeclaration(statement) && ast.IsExternalModuleReference(statement.AsImportEqualsDeclaration().ModuleReference):
			text = "A module declaration's body is an ES module, which imports with import, not import = require()."
		default:
			continue
		}
		// D266 keeps EK diagnostics out of TypeScript files; a module body is part of its .vibe file.
		c.AddDiagnostic(ast.NewExternalDiagnostic(file, scanner.GetErrorRangeForNode(file, statement), diagnosticSource, errorCategory, EK4408.Code, text))
	}
}

// moduleEmitsScript reports whether module, a module declaration's body,
// emits JavaScript (D403): whether the JavaScript of its .vibe file keeps an
// import or re-export of it, by TypeScript's import elision. An import for
// its effects, `import text`, and `export * from text` always stay.
func moduleEmitsScript(resolver printer.EmitResolver, options *core.CompilerOptions, module *ast.SourceFile) bool {
	file := module.CanonicalSourceFile()
	if file == nil {
		return true
	}
	resolver.MarkLinkedReferencesRecursively(file)
	verbatim := options.VerbatimModuleSyntax.IsTrue()
	keepsImport := func(declaration *ast.Node) bool {
		return !declaration.IsTypeOnly() && (verbatim || resolver.IsReferencedAliasDeclaration(declaration))
	}
	keepsExport := func(declaration *ast.Node) bool {
		return !declaration.IsTypeOnly() && (verbatim || resolver.IsValueAliasDeclaration(declaration))
	}
	for _, statement := range file.Statements.Nodes {
		if !ast.IsImportDeclaration(statement) && !ast.IsExportDeclaration(statement) {
			continue
		}
		specifier := statement.ModuleSpecifier()
		if specifier == nil || !parser.IsVibeLangModuleReference(specifier) || specifier.Text() != module.EmbeddedModule().Specifier {
			continue
		}
		switch {
		case ast.IsImportDeclaration(statement):
			clause := statement.AsImportDeclaration().ImportClause
			if clause == nil {
				return true // import text
			}
			if clause.IsTypeOnly() {
				continue
			}
			if clause.Name() != nil && keepsImport(clause) {
				return true
			}
			if bindings := clause.AsImportClause().NamedBindings; bindings != nil {
				if bindings.Kind == ast.KindNamespaceImport {
					if keepsImport(bindings) {
						return true
					}
				} else if core.Some(bindings.Elements(), keepsImport) {
					return true
				}
			}
		case ast.IsExportDeclaration(statement):
			d := statement.AsExportDeclaration()
			switch {
			case d.IsTypeOnly:
			case d.ExportClause == nil || d.ExportClause.Kind == ast.KindNamespaceExport:
				return true // export * from text, export * as text from text
			case core.Some(d.ExportClause.Elements(), keepsExport):
				return true
			}
		}
	}
	return false
}

// moduleExportNameText is the text of a module export name.
func moduleExportNameText(name *ast.Node) string {
	return name.Text()
}
