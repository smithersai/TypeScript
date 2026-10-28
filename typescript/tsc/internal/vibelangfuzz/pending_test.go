package vibelangfuzz

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"
)

// productOwners own a gap in the product; any other owner is the area whose
// test does not reach a part of the specification yet.
var productOwners = map[string]bool{"compiler": true, "projector": true}

var specCitation = regexp.MustCompile(`\bD\d{1,3}\b|Chapter \d+|\bCh \d+|Appendix|LSP`)

// TestPendingLines keeps testdata/pending/ honest: each line names a target
// the package defines, a reproduction that exists, and the part of the
// specification the compiler does not meet yet, so a gap is never an
// unexplained skip.
func TestPendingLines(t *testing.T) {
	entries, err := pendingEntries()
	if err != nil {
		t.Fatal(err)
	}
	targets := fuzzTargets(t)
	seen := map[string]bool{}
	debt := 0
	for _, e := range entries {
		id := e.Target + " " + e.Key
		if seen[id] {
			t.Errorf("%s is listed twice", id)
		}
		seen[id] = true
		if !targets[e.Target] {
			t.Errorf("%s: no target %s in this package", id, e.Target)
		}
		if name, ok := strings.CutPrefix(e.Key, "corpus:"); ok {
			if _, err := os.Stat(filepath.Join(repoTestdata(), "fuzz", e.Target, name)); err != nil {
				t.Errorf("%s: its reproduction is missing: %v", id, err)
			}
		}
		if problem := deadKey(e); problem != "" {
			t.Errorf("%s: %s, so the line skips nothing and never fails as XPASS", id, problem)
		}
		if !productOwners[e.Owner] {
			debt++
			continue
		}
		// A crash or a hang is a bug whatever the specification says; a
		// reproduction may cite the gap it reproduces.
		if specCitation.MatchString(e.Reason) || strings.HasPrefix(e.Reason, "hang") || strings.HasPrefix(e.Key, "crash:") || strings.Contains(e.Reason, "panics") || citesPendingKey(e) {
			continue
		}
		t.Errorf("%s: name the chapter or decision the compiler does not meet: %s", id, e.Reason)
	}
	t.Logf("%d pending lines, %d of them parts of the specification no test reaches yet", len(entries), debt)
}

var ekKey = regexp.MustCompile(`^ek:EK(\d{4})(/.+)?$`)

// deadKey names what is wrong with a key no input can reach: a code Chapter
// 28 never names, or a rule injection that does not exist.
func deadKey(e PendingEntry) string {
	m := ekKey.FindStringSubmatch(e.Key)
	if m == nil {
		return ""
	}
	if !strings.Contains(SpecText("428-part4-ch28-tooling.md"), "EK"+m[1]) {
		return "Chapter 28 never names EK" + m[1]
	}
	if m[2] != "" && e.Target == rulesTarget {
		for _, inj := range ruleInjections {
			if inj.Key() == e.Key {
				return ""
			}
		}
		return "no injection has this key"
	}
	return ""
}

// citesPendingKey reports whether a reproduction's reason names another
// pending key of its target, whose line cites the specification.
func citesPendingKey(e PendingEntry) bool {
	if !strings.HasPrefix(e.Key, "corpus:") {
		return false
	}
	for _, word := range strings.Fields(e.Reason) {
		if _, ok := Pending(e.Target, strings.Trim(word, ",.;()")); ok && word != e.Key {
			return true
		}
	}
	return false
}

// withinPanic is the panic of Within when a stage hangs.
var withinPanic = regexp.MustCompile(`panic: hang: .+ took longer than`)

func isHang(e PendingEntry) bool {
	return strings.HasPrefix(e.Key, "corpus:") && strings.HasPrefix(e.Reason, "hang")
}

// fuzzTargets returns the names of the package's Fuzz functions.
func fuzzTargets(t *testing.T) map[string]bool {
	t.Helper()
	files, err := filepath.Glob("*_test.go")
	if err != nil {
		t.Fatal(err)
	}
	targets := map[string]bool{}
	declaration := regexp.MustCompile(`(?m)^func (Fuzz\w+)\(f \*testing\.F\)`)
	for _, name := range files {
		data, err := os.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range declaration.FindAllStringSubmatch(string(data), -1) {
			targets[m[1]] = true
		}
	}
	return targets
}

// TestPendingHangs runs each pending hang's reproduction in a child test
// process with a deadline, in the smoke run too. A target skips a pending hang, since a hang ends
// the process it runs in; VIBELANG_FUZZ_HANG_PROBE=1 makes the child run it.
// A reproduction that now finishes fails here as XPASS, so its owner
// deletes its line, as any other pending reproduction's.
func TestPendingHangs(t *testing.T) {
	if os.Getenv("VIBELANG_FUZZ_HANG_PROBE") == "1" {
		t.Skip("a probe runs only its reproduction")
	}
	entries, err := pendingEntries()
	if err != nil {
		t.Fatal(err)
	}
	binary, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if !isHang(e) {
			continue
		}
		name := strings.TrimPrefix(e.Key, "corpus:")
		t.Run(e.Target+"/"+name, func(t *testing.T) {
			t.Parallel()
			// Each reproduction outlasts the limit many times over while its
			// bug stands, and a fixed compiler takes well under a second, so
			// the verdict does not depend on the host's load.
			limit := 15 * time.Second
			ctx, cancel := context.WithTimeout(context.Background(), 2*limit)
			defer cancel()
			child := exec.CommandContext(ctx, binary, "-test.run", "^"+e.Target+"$/^"+regexp.QuoteMeta(name)+"$", "-test.v")
			child.Env = append(os.Environ(), "VIBELANG_FUZZ_HANG_PROBE=1", "VIBELANG_FUZZ_HANG="+limit.String())
			out, _ := child.CombinedOutput()
			text := string(out)
			switch {
			case ctx.Err() != nil || withinPanic.MatchString(text):
				t.Logf("still hangs: %s", e.Reason)
			case !strings.Contains(text, "=== RUN   "+e.Target+"/"+name):
				t.Errorf("the probe did not run %s/%s:\n%s", e.Target, name, lastBytes(text, 2000))
			case strings.Contains(text, "--- SKIP: "+e.Target+"/"+name) && !strings.Contains(text, "pending ("):
				t.Errorf("the probe skipped %s/%s, so it cannot tell whether the hang is fixed:\n%s", e.Target, name, lastBytes(text, 2000))
			default:
				t.Errorf("XPASS %s %s: it finishes within %v now; delete its hang line in testdata/pending/ (%s: %s)\n%s", e.Target, e.Key, limit, e.Owner, e.Reason, lastBytes(text, 2000))
			}
		})
	}
}

func lastBytes(text string, n int) string {
	if len(text) > n {
		return "..." + text[len(text)-n:]
	}
	return text
}
