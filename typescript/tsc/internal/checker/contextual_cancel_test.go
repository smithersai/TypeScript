package checker

import (
	"context"
	"testing"
	"time"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
)

// Cancel deterministically inside a single recursive lookup, rather than
// between source elements. No timer scheduling or machine load is involved.
type lookupCancelContext struct {
	context.Context
	polls int
}

func (c *lookupCancelContext) Err() error {
	c.polls++
	if c.polls >= 100 {
		return context.Canceled
	}
	return nil
}

func TestContextualLookupCancellation(t *testing.T) {
	factory := ast.NewNodeFactory(ast.NodeFactoryHooks{})
	defer factory.ReleaseArenas()
	leaf := factory.NewIdentifier("value")
	root := leaf
	for range 10000 {
		parent := factory.NewParenthesizedExpression(root)
		root.Parent = parent
		root = parent
	}
	ctx := &lookupCancelContext{Context: context.Background()}
	expected := &Type{flags: TypeFlagsString}
	c := &Checker{ctx: ctx, contextualInfos: []ContextualInfo{{root, expected, false}}}
	start := time.Now()
	if got := c.getContextualType(leaf, ContextFlagsSignature); got != nil {
		t.Fatal("cancelled lookup continued to the outer contextual type")
	}
	if ctx.polls != 100 {
		t.Fatalf("want cancellation at poll 100, got %d", ctx.polls)
	}
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("cancellation took %s", elapsed)
	}
}
