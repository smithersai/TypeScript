package vibelang

import (
	"cmp"
	"os"
	"regexp"
	"slices"
	"strings"
	"testing"
)

// The platform introduction's table says what EK4402 and EK4403 say: each
// call's Effect replacement, which needs no import (D310, D311), and the
// layer that provides it.
func TestPlatformDocsTable(t *testing.T) {
	page, err := os.ReadFile("../../../../docs/user/src/platform/105-introduction.md")
	if err != nil {
		t.Fatal(err)
	}
	reads := map[string]string{"Date.now": "DateConstructor.now", "performance.now": "Performance.now", "Math.random": "Math.random", "crypto.randomUUID": "Crypto.randomUUID"}
	code := regexp.MustCompile("^`([^`]*)`$")
	rows := 0
	for _, line := range strings.Split(string(page), "\n") {
		cells := strings.Split(strings.Trim(line, "| "), " | ")
		if len(cells) != 3 || !code.MatchString(cells[0]) {
			continue
		}
		rows++
		call := code.FindStringSubmatch(cells[0])[1]
		effect, layer := strings.Trim(cells[1], "`"), strings.Trim(cells[2], "`")
		var s *platformService
		if key, ok := reads[call]; ok {
			read := clockReads[key]
			s = platformServices[read.service]
			if !strings.HasPrefix(read.use, effect) {
				t.Errorf("%s: the page says %s, EK4403 says %s", call, effect, read.use)
			}
		} else {
			root, member, _ := strings.Cut(call, ".")
			ref := platformRef{name: root}
			if service, ok := platformGlobals[root]; ok {
				ref.replacement = service
			} else if service, ok := platformModuleOf(root); ok {
				ref.replacement, ref.module = service, root
			} else {
				t.Errorf("%s is no platform API", call)
				continue
			}
			var members []string
			if member != "" {
				members = strings.Split(member, ".")
			}
			api := platformAPIOf(ref, members)
			s = platformServices[api.service]
			if s == nil {
				t.Errorf("%s: EK4402 names no service", call)
				continue
			}
			if example := cmp.Or(api.example, s.example); example != effect {
				t.Errorf("%s: the page says %s, EK4402 says %s", call, effect, example)
			}
		}
		if s == nil || s.provider == "" {
			if layer != "none" {
				t.Errorf("%s: the page says %s for a service no layer provides", call, layer)
			}
			continue
		}
		if !strings.Contains(s.provider, layer) {
			t.Errorf("%s: the page provides %s, EK4402 says %s", call, layer, s.provider)
		}
	}
	if rows < 10 {
		t.Fatalf("found %d rows in the table of replacements", rows)
	}
}

// platformGlobalAnswer returns what the guide's page on platform globals says
// replaces name, a platform global or a member of one, read from the tables
// EK4402 reads: the Effect, experimental, or browser API's example, or the
// escape to TypeScript with its reason.
func platformGlobalAnswer(name string) string {
	root, member, _ := strings.Cut(name, ".")
	var members []string
	if member != "" {
		members = strings.Split(member, ".")
	}
	api := platformAPIOf(platformRef{replacement: platformGlobals[root], name: root}, members)
	if s := platformServices[api.service]; s != nil {
		if example := cmp.Or(api.example, s.example); example != "" {
			return "`" + example + "`"
		}
		return s.use
	}
	if api.note != "" {
		return "escape to TypeScript for now: " + api.note
	}
	return "escape to TypeScript for now: Effect has no service for it"
}

// TestPlatformGlobalsDocumented checks the guide's page on platform globals
// against the tables EK4402 reads (D310): a row for every platform global
// and every member the tables answer, each saying what EK4402 says, and each
// example in a code block that the snippet checker compiles.
func TestPlatformGlobalsDocumented(t *testing.T) {
	var names []string
	for name := range platformGlobals {
		names = append(names, name)
	}
	for api := range platformAPIs {
		root, _, _ := strings.Cut(api, ".")
		if _, ok := platformGlobals[root]; ok && api != root && !strings.Contains(api, "*") {
			names = append(names, api)
		}
	}
	slices.Sort(names)
	var want []string
	for _, name := range names {
		want = append(want, "| `"+name+"` | "+platformGlobalAnswer(name)+" |")
	}
	page, err := os.ReadFile("../../../../docs/user/src/platform/platform-globals.md")
	if err != nil {
		t.Fatal(err)
	}
	var got, blocks []string
	inBlock := false
	for _, line := range strings.Split(string(page), "\n") {
		switch {
		case strings.HasPrefix(line, "```"):
			inBlock = !inBlock && strings.HasPrefix(line, "```vibe")
		case inBlock:
			blocks = append(blocks, line)
		case strings.HasPrefix(line, "| `"):
			got = append(got, line)
		}
	}
	if !slices.Equal(got, want) {
		t.Errorf("the page's table is\n%s\nEK4402's tables give\n%s", strings.Join(got, "\n"), strings.Join(want, "\n"))
	}
	code := strings.Join(blocks, "\n")
	for _, row := range want {
		if example := regexp.MustCompile("\\| `([^`]*)` \\|$").FindStringSubmatch(row); example != nil && !strings.Contains(code, example[1]) {
			t.Errorf("no vibe block on the page runs %s", example[1])
		}
	}
}
