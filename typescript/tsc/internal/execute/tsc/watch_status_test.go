package tsc

import (
	"bytes"
	"io"
	"strings"
	"testing"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/diagnostics"
	"github.com/microsoft/TypeScript/tsc/internal/locale"
	"github.com/microsoft/TypeScript/tsc/internal/tspath"
	"github.com/microsoft/TypeScript/tsc/internal/vfs/vfstest"
)

type watchStatusTestSystem struct {
	*timingTestSystem
	output bytes.Buffer
	tty    bool
}

func (s *watchStatusTestSystem) Writer() io.Writer      { return &s.output }
func (s *watchStatusTestSystem) WriteOutputIsTTY() bool { return s.tty }

func TestWatchStatusClearsOnlyTerminal(t *testing.T) {
	for _, tty := range []bool{false, true} {
		for _, preserve := range []bool{false, true} {
			for _, message := range []*diagnostics.Message{
				diagnostics.Starting_compilation_in_watch_mode,
				diagnostics.File_change_detected_Starting_incremental_compilation,
			} {
				sys := &watchStatusTestSystem{timingTestSystem: &timingTestSystem{clock: &controlledClock{}, fs: vfstest.FromMap(map[string]string{}, tspath.CaseSensitive)}, tty: tty}
				options := &core.CompilerOptions{Pretty: core.TSFalse, PreserveWatchOutput: core.IfElse(preserve, core.TSTrue, core.TSFalse)}
				reporter := CreateWatchStatusReporter(sys, locale.Default, options, nil)
				reporter(ast.NewCompilerDiagnostic(message))
				output := sys.output.String()
				if got, want := strings.Contains(output, "\x1b[2J"), tty && !preserve; got != want {
					t.Errorf("tty=%v preserve=%v code=%d: clear=%v, want %v: %q", tty, preserve, message.Code(), got, want, output)
				}
				if !strings.Contains(output, "compilation") {
					t.Errorf("missing status: %q", output)
				}
			}
		}
	}
}
