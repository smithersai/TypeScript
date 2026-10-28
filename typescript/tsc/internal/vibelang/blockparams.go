package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/scanner"
)

// Block params (D188, https://github.com/samuelgoto/proposal-block-params):
// in a .vibe file, a block on the same line after a call or a name is a
// program passed to it. A block param is always its call's last argument
// (D376): the parser writes `f(args) { block }` as f(args, () => { block })
// and `f { block }` as f(() => { block }), and the checker and the lowering
// see an ordinary call. The callee's type never moves the block. Through
// VibeLang 0.0.10 an Effect dual took the block in place of its program;
// dual_block_migration.go keeps that rule as a recorder only (D382).

// isBlockParamCall reports whether call passes a block param: its last
// argument is an arrow function with no parameters and a block body, written
// as a bare block, so its text starts with { rather than (.
func isBlockParamCall(call *ast.Node) bool {
	if !ast.IsCallExpression(call) {
		return false
	}
	arguments := call.Arguments()
	if len(arguments) == 0 {
		return false
	}
	arrow := arguments[len(arguments)-1]
	if arrow.Kind != ast.KindArrowFunction || len(arrow.Parameters()) != 0 || arrow.Body() == nil || arrow.Body().Kind != ast.KindBlock {
		return false
	}
	file := ast.GetSourceFileOfNode(call)
	if !isVibeLangFile(file) {
		return false
	}
	text := file.Text()
	start := scanner.SkipTrivia(text, arrow.Pos())
	return start < len(text) && text[start] == '{'
}
