package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/astnav"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
)

// EK4502 explains a missing pipe on the success value of a call. A real
// pipe member on a returned object keeps its ordinary meaning.
var EK4502 = message(4502, errorCategory, "{0} already ran and returned its success value, which has no pipe method.")

func init() {
	registry[EK4502.Code] = EK4502
	checker.RegisterDiagnosticsFilterHook(explainCallPipe)
}

func missingCallPipe(c *checker.Checker, node *ast.Node) *ast.Node {
	if !ast.IsPropertyAccessExpression(node) || node.Name().Text() != "pipe" || !inLowerableBody(node) || inHatch(node) {
		return nil
	}
	receiver := ast.SkipParentheses(node.Expression())
	if !ast.IsCallExpression(receiver) {
		return nil
	}
	t := c.GetTypeAtLocation(receiver)
	if t == nil || t.Flags()&(checker.TypeFlagsAny|checker.TypeFlagsUnknown) != 0 || c.GetPropertyOfType(c.GetApparentType(t), "pipe") != nil {
		return nil
	}
	return receiver
}

func explainCallPipe(c *checker.Checker, file *ast.SourceFile, all []*ast.Diagnostic) []*ast.Diagnostic {
	if !isVibeLangFile(file) {
		return all
	}
	for i, d := range all {
		if d.Source() != "" || (d.Code() != 2339 && d.Code() != 2345) || diagnosticAlreadyExplained(c, file, d) {
			continue
		}
		node := astnav.GetTokenAtPosition(file, d.Pos())
		if d.Code() == 2345 {
			for at := node; at != nil && !isFunctionBoundary(at); at = at.Parent {
				if first := preludePipeRunningCall(c, at); first != nil {
					replacement := newDiagnosticAt(optionsFor(c, file), file, d.Loc(), EK4502.With("{0} already ran and returned its success value before pipe received it."), nodeText(file, first))
					note(replacement, "Start with a program: pipe(() => {0}, …), or use |> with %.", nodeText(file, first))
					all[i] = replacement
					break
				}
			}
			continue
		}
		if node != nil && node.Parent != nil {
			if call := missingCallPipe(c, node.Parent); call != nil {
				replacement := newDiagnosticAt(optionsFor(c, file), file, d.Loc(), EK4502, nodeText(file, call))
				note(replacement, "Use |> with % to pass {0} to the intended operation, or pass the call by name to that operation.", nodeText(file, call))
				all[i] = replacement
			}
		}
	}
	return all
}

// fileChecks may already explain an error with an EK diagnostic and cover
// its TypeScript follow-ons. Do not turn a covered follow-on into a fresh EK
// error before filterCoveredDiagnostics gets to remove it.
func diagnosticAlreadyExplained(c *checker.Checker, file *ast.SourceFile, d *ast.Diagnostic) bool {
	for _, covered := range diagnosticsStateOf(c).covered[file] {
		if covered.Pos() <= d.Pos() && d.End() <= covered.End() {
			return true
		}
	}
	return false
}

// preludePipeRunningCall identifies the Effect-to-value mismatch without
// diagnosing ordinary value pipelines, local functions, or TypeScript code.
func preludePipeRunningCall(c *checker.Checker, node *ast.Node) *ast.Node {
	if !ast.IsCallExpression(node) || len(node.Arguments()) < 2 || !inLowerableBody(node) || inHatch(node) {
		return nil
	}
	if !isEffectFunction(c, node.Expression(), "Function", "pipe") && !isRuntimeExport(c, node.Expression(), "pipe") {
		return nil
	}
	takesProgram := false
	for _, signature := range c.GetSignaturesOfType(c.GetTypeAtLocation(node.Arguments()[1]), checker.SignatureKindCall) {
		if len(signature.Parameters()) > 0 && isEffectType(c, c.GetTypeAtPosition(signature, 0)) {
			takesProgram = true
		}
	}
	if !takesProgram {
		return nil
	}
	first := ast.SkipParentheses(node.Arguments()[0])
	if !ast.IsCallExpression(first) || !callReturnsEffect(c, first) || isEffectType(c, c.GetTypeAtLocation(first)) {
		return nil
	}
	return first
}
