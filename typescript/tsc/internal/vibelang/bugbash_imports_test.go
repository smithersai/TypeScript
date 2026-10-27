package vibelang

import "testing"

func TestBugBashImportURLCharacters(t *testing.T) {
	for source, want := range map[string]string{
		"./hi#1.vibe":    "./hi%231.js",
		"./hi%1.vibe":    "./hi%251.js",
		"./hi%23.vibe":   "./hi%2523.js",
		"../a b/file.ts": "../a%20b/file.js",
		"effect":         "effect",
	} {
		got, _ := outputSpecifierText(source)
		if got != want {
			t.Errorf("%q: got %q, want %q", source, got, want)
		}
	}
}
