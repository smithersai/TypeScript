package vibelangfuzz

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
	"testing"
	"time"

	"golang.org/x/sys/unix"
)

func TestFuzzWorkerArguments(t *testing.T) {
	for _, arg := range []string{"-test.fuzzworker", "-test.fuzzworker=true"} {
		if !isFuzzWorker([]string{"-test.run=FuzzParse", arg}) {
			t.Errorf("%q did not identify a fuzz worker", arg)
		}
	}
	for _, args := range [][]string{nil, {"-test.fuzz=FuzzParse"}, {"-test.fuzzworker=false"}} {
		if isFuzzWorker(args) {
			t.Errorf("%q identified a fuzz worker", args)
		}
	}
}

func TestCloseOnExec(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("the child descriptor check requires /proc/self/fd on Linux")
	}
	var fds [2]int
	// Unlike os.Pipe, syscall.Pipe leaves close-on-exec unset.
	if err := syscall.Pipe(fds[:]); err != nil {
		t.Fatal(err)
	}
	defer syscall.Close(fds[0])
	defer syscall.Close(fds[1])
	for _, fd := range fds {
		flags, err := unix.FcntlInt(uintptr(fd), unix.F_GETFD, 0)
		if err != nil || flags&unix.FD_CLOEXEC != 0 {
			t.Fatalf("pipe descriptor %d already has close-on-exec: flags %d, error %v", fd, flags, err)
		}
	}
	pipe, err := os.Readlink(fmt.Sprintf("/proc/self/fd/%d", fds[0]))
	if err != nil {
		t.Fatal(err)
	}
	if err := closeOnExec(fds[:]...); err != nil {
		t.Fatal(err)
	}
	t.Run("flag", func(t *testing.T) {
		for _, fd := range fds {
			flags, err := unix.FcntlInt(uintptr(fd), unix.F_GETFD, 0)
			if err != nil || flags&unix.FD_CLOEXEC == 0 {
				t.Errorf("descriptor %d lacks close-on-exec: flags %d, error %v", fd, flags, err)
			}
		}
	})
	t.Run("child", func(t *testing.T) {
		out, err := exec.Command("ls", "-l", "/proc/self/fd").CombinedOutput()
		if err != nil {
			t.Fatalf("list child descriptors: %v\n%s", err, out)
		}
		if strings.Contains(string(out), pipe) {
			t.Fatalf("child inherited %s:\n%s", pipe, out)
		}
	})
}

func TestKillChildren(t *testing.T) {
	cmd := exec.Command("sleep", "60")
	if err := startChild(cmd); err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() {
		_ = waitChild(cmd)
		close(done)
	}()
	t.Cleanup(func() {
		_ = syscall.Kill(-cmd.Process.Pid, syscall.SIGKILL)
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			t.Error("sleep was not reaped during cleanup")
		}
		// The watchdog is terminal in a worker; this test keeps running.
		children.Lock()
		children.stopping = false
		children.Unlock()
	})
	killChildren()
	select {
	case <-done:
		if cmd.ProcessState == nil || !cmd.ProcessState.Sys().(syscall.WaitStatus).Signaled() || cmd.ProcessState.Sys().(syscall.WaitStatus).Signal() != syscall.SIGKILL {
			t.Fatalf("sleep did not die of SIGKILL: %v", cmd.ProcessState)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("registered sleep group survived killChildren")
	}
	children.Lock()
	registered := children.commands[cmd]
	children.Unlock()
	if registered {
		t.Fatal("Wait left the child registered")
	}
	late := exec.Command("sleep", "60")
	if err := startChild(late); err == nil {
		_ = syscall.Kill(-late.Process.Pid, syscall.SIGKILL)
		_ = waitChild(late)
		t.Fatal("a child started after the watchdog killed registered groups")
	}
}
