package vibelang

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/bundled"
	"github.com/microsoft/TypeScript/tsc/internal/compiler"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/ls"
	"github.com/microsoft/TypeScript/tsc/internal/ls/lsconv"
	"github.com/microsoft/TypeScript/tsc/internal/lsp/lsproto"
	"github.com/microsoft/TypeScript/tsc/internal/sourcemap"
	"github.com/microsoft/TypeScript/tsc/internal/tsoptions"
	"github.com/microsoft/TypeScript/tsc/internal/tspath"
	"github.com/microsoft/TypeScript/tsc/internal/vfs/osvfs"
)

// moduleEditorSource declares a module (D283) whose body has a character
// that UTF-8 and UTF-16 count differently before a position the tests use,
// so a position measured in the wrong text or unit lands on another token.
var moduleEditorSource = strings.Join([]string{
	"const café = '😀'",
	"module text {",
	"  export function clean(value: string): string {",
	"    return \"é\" + value.trim()",
	"  }",
	"  export const broken: number = \"one\"",
	"}",
	"import { clean } from text",
	"export function main() {",
	"  return sync((input) => clean(input), \" a \") + café",
	"}",
}, "\n")

// The language server serves a module declaration's body from the .vibe
// document: diagnostics, hovers, and definitions inside it, and a definition
// from the file's code into it.
func TestModuleDeclarationEditor(t *testing.T) {
	_, file, service, _ := editorProgram(t, moduleEditorSource)
	uri := lsconv.FileNameToDocumentURI(file.FileName())

	t.Run("diagnostics inside the body", func(t *testing.T) {
		response, err := service.ProvideDiagnostics(t.Context(), uri)
		if err != nil {
			t.Fatal(err)
		}
		var found []string
		for _, d := range response.FullDocumentDiagnosticReport.Items {
			if d.Message.String != nil {
				found = append(found, *d.Message.String)
			}
			if d.Code != nil && d.Code.Integer != nil && *d.Code.Integer == 2322 {
				if d.Range.Start != (lsproto.Position{Line: 5, Character: 15}) {
					t.Fatalf("TS2322 at %+v, want line 5 character 15", d.Range.Start)
				}
				return
			}
		}
		t.Fatalf("no TS2322 for the body's broken constant; got %q", found)
	})

	t.Run("hover inside the body", func(t *testing.T) {
		text := hoverText(t, service, uri, lsproto.Position{Line: 3, Character: 17})
		if !strings.Contains(text, "value: string") {
			t.Fatalf("hover on the body's parameter = %q", text)
		}
	})

	t.Run("hover on an import from the module", func(t *testing.T) {
		text := hoverText(t, service, uri, lsproto.Position{Line: 9, Character: 26})
		if !strings.Contains(text, "clean(value: string): string") {
			t.Fatalf("hover on clean = %q", text)
		}
	})

	t.Run("definition into the body", func(t *testing.T) {
		response, err := service.ProvideDefinition(t.Context(), uri, lsproto.Position{Line: 9, Character: 26})
		if err != nil {
			t.Fatal(err)
		}
		var locations []lsproto.Location
		switch {
		case response.Location != nil:
			locations = append(locations, *response.Location)
		case response.Locations != nil:
			locations = *response.Locations
		case response.DefinitionLinks != nil:
			for _, link := range *response.DefinitionLinks {
				locations = append(locations, lsproto.Location{Uri: link.TargetUri, Range: link.TargetSelectionRange})
			}
		}
		for _, location := range locations {
			if location.Uri == uri && location.Range.Start == (lsproto.Position{Line: 2, Character: 18}) {
				return
			}
		}
		t.Fatalf("definition of clean = %+v, want %s line 2 character 18", locations, uri)
	})
}

// hoverText returns the hover the language service gives at position.
func hoverText(t *testing.T, service *ls.LanguageService, uri lsproto.DocumentUri, position lsproto.Position) string {
	t.Helper()
	response, err := service.ProvideHover(t.Context(), &lsproto.HoverParams{TextDocument: lsproto.TextDocumentIdentifier{Uri: uri}, Position: position})
	if err != nil {
		t.Fatal(err)
	}
	if response.Hover == nil || response.Hover.Contents.MarkupContent == nil {
		return ""
	}
	return response.Hover.Contents.MarkupContent.Value
}

// A module declaration's body is a JavaScript module of its own (D403),
// main.vibe.text.js, whose source map names main.vibe alone and points into
// it at the body's own lines; main.js imports it. A module the file imports
// only types from, and one it never imports, emit no JavaScript.
func TestModuleDeclarationSourceMap(t *testing.T) {
	root, err := filepath.Abs("../../../..")
	if err != nil {
		t.Fatal(err)
	}
	outputs := func(name string) map[string]string {
		dir := copyCompilerFixture(t, filepath.Join(root, "typescript/vibelang/cases", name), root)
		fileSystem := bundled.WrapFS(osvfs.FS())
		config, errors := tsoptions.GetParsedCommandLineOfConfigFile(tspath.RootedFilePathFromAbsolute(filepath.ToSlash(filepath.Join(dir, "tsconfig.json"))), &core.CompilerOptions{SourceMap: core.TSTrue}, nil, fileSystem, nil)
		if len(errors) != 0 {
			t.Fatalf("config: %v", errors)
		}
		program := compiler.NewProgram(compiler.ProgramOptions{Config: config, Host: compiler.NewCompilerHost(fileSystem, bundled.LibPath(), nil, nil, nil)})
		outputs := map[string]string{}
		var mutex sync.Mutex // a program's files emit in parallel
		result := program.Emit(t.Context(), compiler.EmitOptions{WriteFile: func(name tspath.RootedFilePath, text string, _ *compiler.WriteFileData) error {
			mutex.Lock()
			defer mutex.Unlock()
			outputs[filepath.Base(string(name))] = text
			return nil
		}})
		if result.EmitSkipped {
			t.Fatalf("emit skipped: %v", result.Diagnostics)
		}
		source, err := os.ReadFile(filepath.Join(dir, "main.vibe"))
		if err != nil {
			t.Fatal(err)
		}
		outputs["main.vibe"] = string(source)
		return outputs
	}

	t.Run("the body maps into the .vibe file", func(t *testing.T) {
		outputs := outputs("module-declaration")
		if !strings.Contains(outputs["main.js"], `from "./main.vibe.text.js"`) {
			t.Fatalf("main.js does not import its module declaration:\n%s", outputs["main.js"])
		}
		if strings.Contains(outputs["main.js"], `throw new Error("empty")`) {
			t.Fatal("main.js holds the module declaration's body")
		}
		var sourceMap struct {
			Sources  []string `json:"sources"`
			Mappings string   `json:"mappings"`
		}
		if err := json.Unmarshal([]byte(outputs["main.vibe.text.js.map"]), &sourceMap); err != nil {
			t.Fatalf("main.vibe.text.js.map: %v", err)
		}
		if len(sourceMap.Sources) != 1 || !strings.HasSuffix(sourceMap.Sources[0], "/main.vibe") {
			t.Fatalf("sources = %v, want only main.vibe", sourceMap.Sources)
		}
		lineOf := func(text, needle string) int {
			index := strings.Index(text, needle)
			if index < 0 {
				t.Fatalf("missing %q", needle)
			}
			return strings.Count(text[:index], "\n")
		}
		// The throw in clean, inside module text's body.
		want := lineOf(outputs["main.vibe"], `if (trimmed === "") throw new Error("empty")`)
		generated := lineOf(outputs["main.vibe.text.js"], `if (trimmed === "")`)
		for mapping := range sourcemap.DecodeMappings(sourceMap.Mappings).Values() {
			if mapping.GeneratedLine == generated && mapping.IsSourceMapping() {
				if mapping.SourceLine != want {
					t.Fatalf("main.vibe.text.js line %d maps to main.vibe line %d, want %d", generated+1, mapping.SourceLine+1, want+1)
				}
				return
			}
		}
		t.Fatalf("main.vibe.text.js line %d has no source mapping", generated+1)
	})

	t.Run("only imported modules emit JavaScript", func(t *testing.T) {
		outputs := outputs("module-declaration-emit")
		for name, emitted := range map[string]bool{
			"main.vibe.text.js": true, "main.vibe.config.js": true, "main.vibe.setup.js": true, "main.vibe.extras.js": true,
			"main.vibe.shapes.js": false, "main.vibe.unused.js": false,
		} {
			if _, ok := outputs[name]; ok != emitted {
				t.Errorf("%s emitted: %v, want %v", name, ok, emitted)
			}
		}
	})
}
