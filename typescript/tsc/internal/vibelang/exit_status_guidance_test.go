package vibelang

import (
	"strings"
	"testing"
)

func TestPlatformExitStatusGuidance(t *testing.T) {
	for _, name := range []string{"process.exit", "process.exitCode"} {
		t.Run(name, func(t *testing.T) {
			answer := platformGlobalAnswer(name)
			for _, meaning := range []string{"return from main for exit 0", "fail for exit 1", "interruption exits 130"} {
				if !strings.Contains(answer, meaning) {
					t.Errorf("%s guidance %q omits %q", name, answer, meaning)
				}
			}
		})
	}
}
