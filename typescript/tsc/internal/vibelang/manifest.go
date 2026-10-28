package vibelang

import (
	"encoding/json"
	"slices"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"github.com/microsoft/TypeScript/tsc/internal/compiler"
	"github.com/microsoft/TypeScript/tsc/internal/tspath"
)

// A package compiled from VibeLang publishes vibelang.manifest.json beside
// its declarations (compiler.VibeLangManifestName, D500). A declaration file
// that the nearest manifest above it lists, up to its package's root, is
// trusted as a package in trustedPackages is (D261): its plain functions and
// methods were compiled from VibeLang, so a call of one is a trusted plain
// call, whose exceptions are defects, not EK4401.

// manifestsKey keys the checker's cache of the manifests it read.
type manifestsKey struct{}

// listedInManifest reports whether file, a declaration file, is listed in
// the nearest vibelang.manifest.json above it, up to its package's root.
func listedInManifest(c *checker.Checker, file *ast.SourceFile) bool {
	if file == nil || !file.IsDeclarationFile {
		return false
	}
	program, ok := c.Program().(interface{ Host() compiler.CompilerHost })
	if !ok {
		return false
	}
	cache := c.ExtensionState(manifestsKey{}, func() any { return map[tspath.RootedFilePath]*compiler.VibeLangManifest{} }).(map[tspath.RootedFilePath]*compiler.VibeLangManifest)
	read := func(path tspath.RootedFilePath) *compiler.VibeLangManifest {
		if m, ok := cache[path]; ok {
			return m
		}
		var m *compiler.VibeLangManifest
		if text, ok := program.Host().FS().ReadFile(path); ok {
			m = &compiler.VibeLangManifest{}
			if json.Unmarshal([]byte(text), m) != nil {
				m = nil
			}
		}
		cache[path] = m
		return m
	}
	root, _ := packageRootOf(c, file.FileName().Directory())
	for directory := file.FileName().Directory(); ; {
		if m := read(directory.ResolveFile(compiler.VibeLangManifestName)); m != nil {
			relative := tspath.GetRelativePathFromDirectory(directory.AsString(), file.FileName().AsString(), c.Program().CaseSensitivity())
			return slices.Contains(m.Declarations, relative)
		}
		parent := directory.AsPath().Directory()
		if directory == root || parent == directory {
			return false
		}
		directory = parent
	}
}
