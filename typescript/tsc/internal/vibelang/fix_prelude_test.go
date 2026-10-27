package vibelang

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/bundled"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/tsoptions"
	"github.com/microsoft/TypeScript/tsc/internal/tspath"
	"github.com/microsoft/TypeScript/tsc/internal/vfs/osvfs"
)

// vibelang --fix removes the imports that D310 and D311 make redundant and
// writes M.M as M where a module's name names its export, keeping what the
// program means: a use the module's name cannot stand for keeps the key,
// and an import a JavaScript global would take the place of stays. A second
// run finds nothing to fix.
func TestFixPreludeRewrites(t *testing.T) {
	source := `import { FileSystem } from "effect/FileSystem"
import * as Path from "effect/Path"
import { HttpClient } from "effect/http"
import * as ChildProcess from "effect/process/ChildProcess"
import { Array as Arr, Option } from "effect"

export const read = (path: string) => FileSystem.readFileString(Path.Path.join(path, "a"))
export const key = FileSystem
export const first = (value: Option.Option<number>): number => Option.getOrElse(value, () => 0)
export const get = (url: string) => HttpClient.get(url)
export const command = ChildProcess.make("ls")
export const two = Arr.take([1, 2, 3], 2)
export function implementation() {
  return [FileSystem(), Path.Path()]
}
`
	want := `import { Array as Arr } from "effect"

export const read = (path: string) => FileSystem.readFileString(Path.join(path, "a"))
export const key = FileSystem.FileSystem
export const first = (value: Option<number>): number => Option.getOrElse(value, () => 0)
export const get = (url: string) => HttpClient.get(url)
export const command = ChildProcess.make("ls")
export const two = Arr.take([1, 2, 3], 2)
export function implementation() {
  return [FileSystem(), Path()]
}
`
	_, file, _, _ := editorProgram(t, source)
	dir := filepath.Dir(file.FileName().AsString())
	if err := os.WriteFile(filepath.Join(dir, "tsconfig.json"), []byte(`{"compilerOptions":{"target":"ES2022","module":"NodeNext","strict":true,"skipLibCheck":true,"noEmit":true},"files":["main.vibe"]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	fs := bundled.WrapFS(osvfs.FS())
	config, errors := tsoptions.GetParsedCommandLineOfConfigFile(tspath.RootedFilePathFromAbsolute(filepath.ToSlash(filepath.Join(dir, "tsconfig.json"))), &core.CompilerOptions{}, nil, fs, nil)
	if len(errors) != 0 {
		t.Fatalf("config: %v", errors)
	}
	result := FixProject(t.Context(), fs, bundled.LibPath(), config)
	fixed := result.Files[file.FileName()]
	if fixed == nil || fixed.Text != want || len(result.Refused) != 0 {
		got := ""
		if fixed != nil {
			got = fixed.Text
		}
		t.Fatalf("--fix wrote\n%s\nwant\n%s\nrefused %+v", got, want, result.Refused)
	}
	if fixed.Rewrites[preludeImportLabel] != 5 || fixed.Rewrites[preludeKeyLabel] != 3 {
		t.Errorf("rewrites %v; want 5 imports and 3 module exports", fixed.Rewrites)
	}
	var report strings.Builder
	result.Report(&report, func(name tspath.RootedFilePath) string { return filepath.Base(name.AsString()) })
	if !strings.Contains(report.String(), "main.vibe: 8 fixes (prelude import ×5, module export ×3)") {
		t.Errorf("report:\n%s", report.String())
	}
	if err := os.WriteFile(file.FileName().AsString(), []byte(want), 0o600); err != nil {
		t.Fatal(err)
	}
	if again := FixProject(t.Context(), fs, bundled.LibPath(), config); len(again.Order) != 0 {
		t.Errorf("a second --fix changed %v", again.Order)
	}
}
