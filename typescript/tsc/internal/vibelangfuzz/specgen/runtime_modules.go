package specgen

import (
	"fmt"
	"strings"
)

// ModuleFile names a sibling of entry. Each variant's graph has its own
// files and module state (Chapter 26 Modules).
func ModuleFile(entry string, module int) string {
	if module == 0 {
		return entry
	}
	return fmt.Sprintf("%s_graph%d.vibe", strings.TrimSuffix(entry, ".vibe"), module)
}

// PrintVibeFiles prints two or three interacting modules when requested by
// the model. Imports are cyclic; calls form a bounded chain through exported
// functions, so the Chapter 27 rule 1 contract crosses file boundaries.
func PrintVibeFiles(p *Program, o VibeOptions, entry string) map[string]string {
	if p.ModuleCount < 2 {
		return map[string]string{entry: PrintVibe(p, o)}
	}
	main := *p
	main.Funcs = nil
	var imports strings.Builder
	for _, f := range p.Funcs {
		if f.Module == 0 {
			main.Funcs = append(main.Funcs, f)
			continue
		}
		fmt.Fprintf(&imports, "import { %s } from %q\n", f.Name, "./"+ModuleFile(entry, f.Module))
	}
	o.exportDecls = true
	files := map[string]string{entry: imports.String() + PrintVibe(&main, o)}
	for module := 1; module < p.ModuleCount; module++ {
		v := &vibePrinter{p: p, o: o}
		var declarations []string
		for _, e := range p.Errors {
			declarations = append(declarations, e.Name)
		}
		for _, s := range p.Services {
			declarations = append(declarations, s.Name)
		}
		v.w.line("import { %s } from %q", strings.Join(declarations, ", "), "./"+entry)
		for _, f := range p.Funcs {
			if f.Module != module {
				continue
			}
			walkStmts(f.Body, nil, func(x Expr) {
				if c, ok := x.(*Call); ok && c.Fn.Module != module {
					v.w.line("import { %s } from %q", c.Fn.Name, "./"+ModuleFile(entry, c.Fn.Module))
				}
			})
			v.function(f)
		}
		files[ModuleFile(entry, module)] = v.w.b.String()
	}
	return files
}
