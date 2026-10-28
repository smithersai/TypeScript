package vibelangfuzz

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

// TestRuntimeOutcomes checks Chapter 27 rule 1 and Chapter 17's ordered causes
// against direct Effect 4 programs, independently of compiler lowering.
func TestRuntimeOutcomes(t *testing.T) {
	w := NewWorkspace(t)
	n, err := NewNode(w.Dir)
	if err != nil {
		t.Fatal(err)
	}
	defer n.Close()
	r := &Result{Dir: filepath.Join(w.Dir, "runtime"), Outputs: map[string]string{"main.mjs": `
import { Effect, Cause } from "effect";
export const plain = () => 42;
export const success = () => Effect.succeed(42);
export const failures = () => Effect.failCause(Cause.combine(Cause.fail({_tag:"A"}), Cause.fail({_tag:"B"})));
export const mixed = () => Effect.ensuring(Effect.fail({_tag:"A"}), Effect.die({_tag:"D"}));
export const interruptedFailure = () => Effect.failCause(Cause.combine(Cause.interrupt(123), Cause.fail({_tag:"A"})));
export const interrupted = () => Effect.interrupt;
export const crash = () => { throw new Error("fixture") };
export const hang = () => Effect.never;
const trace = [];
export const traceOf = () => trace;
export const cold = () => Effect.sync(() => { trace.push("ran"); return 1 });
export const eager = () => { trace.push("called"); return Effect.succeed(1) };
`}}
	for _, tc := range []struct {
		name, kind, value, tag string
		cause                  []string
	}{
		{"plain", "plain", "42", "", nil},
		{"success", "success", "42", "", nil},
		{"failures", "failure", `{"_tag":"A"}`, "A", []string{"fail:A", "fail:B"}},
		{"mixed", "defect", "", "A", []string{"die:A", "die:D"}},
		{"interruptedFailure", "failure", `{"_tag":"A"}`, "A", []string{"interrupt", "fail:A"}},
		{"interrupted", "interrupt", "", "", []string{"interrupt"}},
		{"crash", "crash", "", "Error", nil},
	} {
		t.Run(tc.name, func(t *testing.T) {
			got := n.Run(r, "main.mjs", tc.name)
			if got.Kind != tc.kind || string(got.Value) != tc.value || got.Tag != tc.tag || !slices.Equal(got.Cause, tc.cause) {
				t.Fatalf("got %+v; want kind=%s value=%s tag=%s cause=%v", got, tc.kind, tc.value, tc.tag, tc.cause)
			}
		})
	}
	cold := n.RunObserved(r, "main.mjs", "cold")
	if string(cold.BeforeCall) != "[]" || string(cold.AfterCall) != "[]" || string(cold.Trace) != `["ran"]` {
		t.Fatalf("cold observation: %+v", cold)
	}
	eager := n.RunObserved(r, "main.mjs", "eager")
	if string(eager.BeforeCall) == string(eager.AfterCall) {
		t.Fatalf("lost eager observation: %+v", eager)
	}
	// Recycling releases ESM modules and both pipe descriptors.
	first, pipe := n.cmd.Process.Pid, n.answerPipe
	for i := 0; i < workerRunLimit; i++ {
		if got := n.Run(r, "main.mjs", "success"); got.Kind != "success" {
			t.Fatal(got)
		}
	}
	if n.cmd.Process.Pid == first {
		t.Fatal("worker was not recycled")
	}
	if _, err := pipe.Stat(); !errors.Is(err, os.ErrClosed) {
		t.Fatalf("recycled answer pipe: %v", err)
	}

	// A timeout must release a blocked read and allow a subsequent run.
	pipe = n.answerPipe
	saved := RunLimit
	RunLimit = time.Second
	got := n.Run(r, "main.mjs", "hang")
	RunLimit = saved
	if got.Kind != "timeout" {
		t.Fatalf("hang: %+v", got)
	}
	if _, err := pipe.Stat(); !errors.Is(err, os.ErrClosed) {
		t.Fatalf("timeout answer pipe: %v", err)
	}
	if got := n.Run(r, "main.mjs", "success"); got.Kind != "success" {
		t.Fatalf("after timeout: %+v", got)
	}
	pipe = n.answerPipe
	n.Close()
	if _, err := pipe.Stat(); err == nil {
		t.Fatal("closed answer pipe is still open")
	}
	if got := n.Run(r, "main.mjs", "success"); got.Kind != "crash" {
		t.Fatalf("run after Close: %+v", got)
	}
}

// TestRuntimeSemanticComparison never accepts a broken ABI or failed runner
// as semantic agreement (Chapter 27 rule 1), and compares every cause reason
// in order (Chapter 17, D305 and D306).
func TestRuntimeSemanticComparison(t *testing.T) {
	for _, kind := range []string{"plain", "crash", "timeout", ""} {
		o := specObserved{Outcome: Outcome{Kind: kind}}
		if ok, _ := specSameOutcome(o, o); ok {
			t.Errorf("accepted %q", kind)
		}
	}
	a := specObserved{Outcome: Outcome{Kind: "failure", Tag: "A", Value: []byte(`{"_tag":"A"}`), Cause: []string{"fail:A"}}}
	b := a
	b.Outcome.Cause = []string{"fail:A", "fail:B"}
	if ok, _ := specSameOutcome(a, b); ok {
		t.Error("lost second failure")
	}
	a.Outcome.Cause = []string{"fail:A", "fail:B"}
	b.Outcome.Cause = []string{"fail:B", "fail:A"}
	if ok, _ := specSameOutcome(a, b); ok {
		t.Error("lost cause order")
	}
	b = a
	b.Outcome.BeforeCall, b.Outcome.AfterCall = []byte(`[]`), []byte(`["eager"]`)
	if ok, _ := specSameOutcome(b, b); ok {
		t.Error("accepted eager call")
	}
}
