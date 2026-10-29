package vibelangfuzz

import (
	"fmt"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"golang.org/x/sys/unix"
)

// closeOnExec keeps the fuzz engine's pipes out of children of a worker.
func closeOnExec(fds ...int) error {
	for _, fd := range fds {
		flags, err := unix.FcntlInt(uintptr(fd), unix.F_GETFD, 0)
		if err != nil {
			return fmt.Errorf("get descriptor %d flags: %w", fd, err)
		}
		if _, err := unix.FcntlInt(uintptr(fd), unix.F_SETFD, flags|unix.FD_CLOEXEC); err != nil {
			return fmt.Errorf("mark descriptor %d close-on-exec: %w", fd, err)
		}
	}
	return nil
}

// logStderr appends what the process writes to standard error to the file
// at path. The fuzz engine starts its workers with standard error discarded,
// so without it a worker that dies of a hang panic or a fatal runtime error
// leaves only "terminated unexpectedly: exit status 2" behind.
func logStderr(path string) error {
	file, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	defer file.Close()
	return unix.Dup2(int(file.Fd()), 2)
}

// children holds started process groups until Wait has reaped their leaders.
var children = struct {
	sync.Mutex
	commands map[*exec.Cmd]bool
	stopping bool
}{commands: make(map[*exec.Cmd]bool)}

// startChild starts and registers a child atomically with respect to the
// watchdog, so a hang cannot leave a newly started group unregistered.
func startChild(cmd *exec.Cmd) error {
	children.Lock()
	defer children.Unlock()
	if children.stopping {
		return fmt.Errorf("the fuzz watchdog is stopping child processes")
	}
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setpgid = true
	if err := cmd.Start(); err != nil {
		return err
	}
	children.commands[cmd] = true
	return nil
}

// waitChild reaps a child and removes its process group from the registry.
func waitChild(cmd *exec.Cmd) error {
	err := cmd.Wait()
	children.Lock()
	delete(children.commands, cmd)
	children.Unlock()
	return err
}

// killChildren stops every registered process group before a hang panic
// ends the worker, including descendants that hold its inherited pipes.
func killChildren() {
	children.Lock()
	defer children.Unlock()
	// No child may start between this cleanup and the watchdog's panic.
	children.stopping = true
	for cmd := range children.commands {
		pid := cmd.Process.Pid
		if err := syscall.Kill(-pid, syscall.SIGKILL); err != nil && err != syscall.ESRCH {
			fmt.Fprintf(os.Stderr, "fuzz watchdog: kill process group %d: %v\n", pid, err)
		} else {
			fmt.Fprintf(os.Stderr, "fuzz watchdog: killed process group %d\n", pid)
		}
	}
}
