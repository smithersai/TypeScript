package vibelangfuzz

import (
	"fmt"
	"os"
	"testing"
)

// TestMain marks the fuzz engine's pipes before m.Run can start any target
// or child. This belongs to the test binary's startup, rather than package
// initialization, and leaves descriptors alone outside fuzz workers.
func TestMain(m *testing.M) {
	if isFuzzWorker(os.Args[1:]) {
		if err := closeOnExec(3, 4, 5); err != nil {
			fmt.Fprintf(os.Stderr, "fuzz worker pipes: %v\n", err)
			os.Exit(1)
		}
	}
	os.Exit(m.Run())
}

func isFuzzWorker(args []string) bool {
	for _, arg := range args {
		if arg == "-test.fuzzworker" || arg == "-test.fuzzworker=true" {
			return true
		}
	}
	return false
}
