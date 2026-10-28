package vibelang

import (
	"slices"
	"strconv"
	"strings"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// In a function with a contract-less callback parameter, a written contract
// names the channels D68 adds as E and R, then E2 and R2 for the second such
// parameter, in parameter order (D434). Where the return annotation or the
// type of another parameter names one of them while a declaration with a type
// meaning of that name is in scope there, a type parameter, type alias,
// interface, class, enum or imported type, the name is EK2130 (D455):
//
//	type E = string
//	function run(work: () => number): number!E { return work() }   // EK2130 at E
//
// The compiler does not yet read the names as the channels, so it reports
// EK2130 where the collision makes the contract reject its body: in place of
// the EK2001 and EK2002 that read the name one way or the other, as "its
// contract says R = R". A program that compiled still compiles; EK2130 for
// every collision is a language change that waits for D434's names.

// EK2130: a name of a contract-less callback's channel that a type in scope
// already has. {0} is the name, {1} the callback parameter, {2} "error" or
// "requirement".
var EK2130 = message(2130, errorCategory, "{0} here names the {2} channel of {1}, which has no contract, but a type named {0} is already in scope.")

func init() {
	registry[EK2130.Code] = EK2130
}

// reportChannelNameCollisions reports EK2130 at each of collisions, the
// names in one signature in file that name a callback's channel and a type.
func reportChannelNameCollisions(c *checker.Checker, file *ast.SourceFile, collisions []channelName) {
	for _, collision := range collisions {
		d := report(c, collision.name, EK2130, collision.name.Text(), declarationName(collision.callback), collision.channel)
		note(d, "Name the channels with type parameters of your own, {0}, and write F and Q in the contract; or rename the type {1}.", ownChannelsText(file, collision.callback), collision.name.Text())
	}
}

// A channelName is a name in a signature that names a channel of one of its
// contract-less callback parameters.
type channelName struct {
	name     *ast.Node // the identifier of the type reference
	callback *ast.Node // the callback parameter
	channel  string    // "error" or "requirement"
}

// channelNameCollisions returns the names in fn's return annotation and in
// the types of its other parameters that name a channel of one of fn's
// contract-less callback parameters while a type of that name is in scope.
func (a *analyzer) channelNameCollisions(fn *ast.Node) []channelName {
	if !acceptsAnyContract(fn) {
		return nil
	}
	var callbacks []*ast.Node
	for _, parameter := range fn.Parameters() {
		if a.isUncontractedCallback(parameter) {
			callbacks = append(callbacks, parameter)
		}
	}
	if len(callbacks) == 0 {
		return nil
	}
	channels := map[string]channelName{}
	for i, parameter := range callbacks {
		suffix := ""
		if i > 0 {
			suffix = strconv.Itoa(i + 1)
		}
		channels["E"+suffix] = channelName{callback: parameter, channel: "error"}
		channels["R"+suffix] = channelName{callback: parameter, channel: "requirement"}
	}
	var found []channelName
	var visit func(n *ast.Node) bool
	visit = func(n *ast.Node) bool {
		if ast.IsTypeReferenceNode(n) {
			if name := n.AsTypeReferenceNode().TypeName; ast.IsIdentifier(name) {
				if channel, ok := channels[name.Text()]; ok {
					if symbol := a.checker.GetSymbolAtLocation(name); symbol != nil && symbol.Flags()&(ast.SymbolFlagsType|ast.SymbolFlagsAlias) != 0 {
						channel.name = name
						found = append(found, channel)
					}
				}
			}
		}
		return n.ForEachChild(visit)
	}
	for _, parameter := range fn.Parameters() {
		if t := parameter.Type(); t != nil && !slices.Contains(callbacks, parameter) {
			visit(t)
		}
	}
	if t := fn.Type(); t != nil {
		visit(t)
	}
	return found
}

// ownChannelsText writes callback, a contract-less callback parameter, with
// a contract whose channels are type parameters F and Q: work: () => A!F!Q.
func ownChannelsText(file *ast.SourceFile, callback *ast.Node) string {
	name := declarationName(callback)
	t := callback.Type()
	if t == nil || t.Type() == nil {
		return name
	}
	written, returned := nodeText(file, t), nodeText(file, t.Type())
	prefix, ok := strings.CutSuffix(written, returned)
	if !ok {
		return name
	}
	return name + ": " + prefix + bangText(returned, "F", "Q")
}
