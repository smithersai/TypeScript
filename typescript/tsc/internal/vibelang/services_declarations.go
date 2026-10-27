package vibelang

import (
	"slices"

	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"github.com/microsoft/TypeScript/tsc/internal/compiler"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/printer"
)

// The declaration file of a service or control class (design D45). The
// declaration transform writes the class as it is in source:
//
//	export declare abstract class Users {
//	    abstract find(id: string): Effect.Effect<User, UserNotFound, never>;
//	    static readonly layer: Layer.Layer<Users, never, never>;
//	}
//
// TypeScript code that imports it must see what the checker sees in .vibe
// files: an interface for the shape, branded with the key, merged with a
// class whose static side is a Context key, the runtime's ServiceKey:
//
//	export interface Users {
//	    find(id: string): Effect.Effect<User, UserNotFound, never>;
//	    readonly "~vibelang/service"?: "app/users#Users";
//	}
//	declare const Users_base: import("vibelang-runtime").ServiceKey<Users>;
//	export declare abstract class Users extends Users_base {
//	    static readonly layer: Layer.Layer<Users, never, never>;
//	}
//
// A service with a static default extends ReferenceKey instead. A service of
// any shape (D281) names its shape, and its interface holds only the brand:
//
//	export interface Prefix {
//	    readonly "~vibelang/service"?: "app/main#Prefix";
//	}
//	declare const Prefix_base: import("vibelang-runtime").ServiceKey<Prefix, string>;
//	export declare abstract class Prefix extends Prefix_base {
//	}
//
// A service in a namespace is written the same way inside the namespace's
// body, which is ambient, so nothing in it says declare. A body whose
// members are all exported carries no export modifiers, so the body gains
// them and an empty export, which keeps the base constant private.

func init() { compiler.RegisterDeclarationTransformerHook(serviceDeclarations) }

func serviceDeclarations(resolver printer.EmitResolver, file *ast.SourceFile) func(*ast.SourceFile) *ast.SourceFile {
	r, ok := resolver.(*checker.EmitResolver)
	if !ok || !isVibeLangFile(file) {
		return nil
	}
	keys := map[*ast.Node]string{}
	r.WithChecker(func(c *checker.Checker) {
		s := servicesFor(c)
		var collect func(statements []*ast.Node)
		collect = func(statements []*ast.Node) {
			for _, statement := range statements {
				if classKindOf(statement) != ordinaryClass {
					keys[statement] = s.key(statement)
				}
				if body := namespaceBlock(statement); body != nil {
					collect(body.Statements())
				}
			}
		}
		collect(file.Statements.Nodes)
	})
	if len(keys) == 0 {
		return nil
	}
	ec := resolver.EmitContext()
	return func(declarations *ast.SourceFile) *ast.SourceFile {
		names := &freshNames{file: file} // the base constants' names (hygiene.go)
		statements, changed := serviceStatements(ec, names, declarations.Statements.Nodes, keys, false /*ambient*/)
		if !changed {
			return declarations
		}
		list := ec.Factory.NewNodeList(statements)
		list.Loc = declarations.Statements.Loc
		return ec.Factory.UpdateSourceFile(declarations, list, declarations.EndOfFileToken).AsSourceFile()
	}
}

// namespaceBlock returns the body of statement, a namespace declaration,
// through the declarations a dotted name nests, or nil.
func namespaceBlock(statement *ast.Node) *ast.Node {
	for statement != nil && ast.IsModuleDeclaration(statement) {
		body := statement.Body()
		if body != nil && ast.IsModuleBlock(body) {
			return body
		}
		statement = body
	}
	return nil
}

// serviceStatements returns statements, those of a declaration file or,
// when ambient, of a namespace's body, with each service class written as
// serviceDeclaration writes it, in nested namespaces too, and whether any
// changed. In a body without an export declaration every member is
// exported, so when a service is written there, each member gains the
// export modifier it stands for, and an empty export keeps the base
// constant private.
func serviceStatements(ec *printer.EmitContext, names *freshNames, statements []*ast.Node, keys map[*ast.Node]string, ambient bool) ([]*ast.Node, bool) {
	allExported := ambient && !core.Some(statements, func(s *ast.Node) bool { return ast.IsExportDeclaration(s) || ast.IsExportAssignment(s) })
	var result, bases []*ast.Node
	changed := false
	for _, statement := range statements {
		if class := ec.MostOriginal(statement); ast.IsClassDeclaration(statement) && keys[class] != "" {
			written := serviceDeclaration(ec, names, statement, class, keys[class], ambient, allExported || ast.HasSyntacticModifier(statement, ast.ModifierFlagsExport))
			result = append(result, written...)
			bases = append(bases, written[1])
			changed = true
			continue
		}
		if ast.IsModuleDeclaration(statement) {
			if namespace, ok := serviceNamespace(ec, names, statement, keys); ok {
				statement = namespace
				changed = true
			}
		}
		result = append(result, statement)
	}
	if len(bases) == 0 || !allExported {
		return result, changed
	}
	f := ec.Factory.AsNodeFactory()
	for i, statement := range result {
		if slices.Contains(bases, statement) || !ast.CanHaveModifiers(statement) || ast.IsImportEqualsDeclaration(statement) {
			continue
		}
		if flags := ast.GetCombinedModifierFlags(statement); flags&(ast.ModifierFlagsExport|ast.ModifierFlagsDefault) == 0 {
			modifiers := ast.CreateModifiersFromModifierFlags(flags|ast.ModifierFlagsExport, f.NewModifier)
			result[i] = ast.ReplaceModifiers(f, statement, f.NewModifierList(modifiers))
		}
	}
	empty := f.NewExportDeclaration(nil /*modifiers*/, false /*isTypeOnly*/, f.NewNamedExports(f.NewNodeList([]*ast.Node{})), nil /*moduleSpecifier*/, nil /*attributes*/)
	return append(result, empty), true
}

// serviceNamespace returns namespace, a namespace declaration of a
// declaration file, with the services in its body written by
// serviceStatements, and whether any changed.
func serviceNamespace(ec *printer.EmitContext, names *freshNames, namespace *ast.Node, keys map[*ast.Node]string) (*ast.Node, bool) {
	f := ec.Factory
	body := namespace.Body()
	switch {
	case body == nil:
		return namespace, false
	case ast.IsModuleDeclaration(body):
		inner, ok := serviceNamespace(ec, names, body, keys)
		if !ok {
			return namespace, false
		}
		body = inner
	case ast.IsModuleBlock(body):
		statements, ok := serviceStatements(ec, names, body.Statements(), keys, true /*ambient*/)
		if !ok {
			return namespace, false
		}
		list := f.NewNodeList(statements)
		list.Loc = body.StatementList().Loc
		body = f.UpdateModuleBlock(body.AsModuleBlock(), list)
	default:
		return namespace, false
	}
	declaration := namespace.AsModuleDeclaration()
	return f.UpdateModuleDeclaration(declaration, namespace.Modifiers(), declaration.Keyword, namespace.Name(), declaration.Attributes, body), true
}

// serviceDeclaration returns the declarations of a service: declared, the
// class the declaration transform wrote for class, becomes an interface for
// its instance members and the brand, a `<Name>_base` constant typed with the
// runtime's key type, and a class that extends it with the static members.
// exported says whether the service is exported, and ambient that it is in
// a namespace's body, where nothing says declare. The constant's name is
// fresh (hygiene.go): Users_base$1 when the source spells Users_base.
func serviceDeclaration(ec *printer.EmitContext, names *freshNames, declared, class *ast.Node, key string, ambient, exported bool) []*ast.Node {
	f := ec.Factory
	name := declared.Name().Text()
	isDefault := ast.HasSyntacticModifier(declared, ast.ModifierFlagsDefault)
	exported = exported && !isDefault
	var declare []*ast.Node
	if !ambient {
		declare = []*ast.Node{f.NewModifier(ast.KindDeclareKeyword)}
	}

	var shape, statics []*ast.Node
	for _, member := range declared.Members() {
		switch {
		case ast.IsStatic(member):
			statics = append(statics, member)
		case ast.IsMethodDeclaration(member):
			shape = append(shape, f.NewMethodSignatureDeclaration(nil /*modifiers*/, member.Name(), member.PostfixToken(), member.TypeParameterList(), member.ParameterList(), member.Type()))
		case ast.IsPropertyDeclaration(member):
			var modifiers *ast.ModifierList
			if ast.HasSyntacticModifier(member, ast.ModifierFlagsReadonly) {
				modifiers = f.NewModifierList([]*ast.Node{f.NewModifier(ast.KindReadonlyKeyword)})
			}
			shape = append(shape, f.NewPropertySignatureDeclaration(modifiers, member.Name(), member.PostfixToken(), member.Type(), nil /*initializer*/))
		}
	}
	shape = append(shape, f.NewPropertySignatureDeclaration(
		f.NewModifierList([]*ast.Node{f.NewModifier(ast.KindReadonlyKeyword)}),
		f.NewStringLiteral(serviceBrandProperty, ast.TokenFlagsNone),
		f.NewToken(ast.KindQuestionToken),
		f.NewLiteralTypeNode(f.NewStringLiteral(key, ast.TokenFlagsNone)),
		nil, /*initializer*/
	))
	var interfaceModifiers *ast.ModifierList
	if exported {
		interfaceModifiers = f.NewModifierList([]*ast.Node{f.NewModifier(ast.KindExportKeyword)})
	}
	shapeDeclaration := f.NewInterfaceDeclaration(interfaceModifiers, f.NewIdentifier(name), nil /*typeParameters*/, nil /*heritageClauses*/, f.NewNodeList(shape))

	keyType := "ServiceKey"
	keyArguments := []*ast.Node{f.NewTypeReferenceNode(f.NewIdentifier(name), nil /*typeArguments*/)}
	if shape := writtenShape(declared, class); shape != nil {
		// service Name: Type (D281): ServiceKey<Name, Type>, or ReferenceKey<Type>.
		keyArguments = append(keyArguments, shape)
	}
	if hasStaticDefault(class) {
		keyType = "ReferenceKey"
		keyArguments = keyArguments[len(keyArguments)-1:]
	}
	base := names.freshName(name + "_base")
	baseType := f.NewImportTypeNode(false /*isTypeOf*/, f.NewLiteralTypeNode(f.NewStringLiteral("vibelang-runtime", ast.TokenFlagsNone)), nil /*attributes*/, f.NewIdentifier(keyType), f.NewNodeList(keyArguments))
	baseDeclaration := f.NewVariableStatement(
		f.NewModifierList(declare),
		f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{f.NewVariableDeclaration(f.NewIdentifier(base), nil /*exclamationToken*/, baseType, nil /*initializer*/)}), ast.NodeFlagsConst),
	)

	classModifiers := []*ast.Node{}
	if exported {
		classModifiers = append(classModifiers, f.NewModifier(ast.KindExportKeyword))
	}
	classModifiers = append(append(classModifiers, declare...), f.NewModifier(ast.KindAbstractKeyword))
	extends := f.NewHeritageClause(ast.KindExtendsKeyword, f.NewNodeList([]*ast.Node{f.NewExpressionWithTypeArguments(f.NewIdentifier(base), nil /*typeArguments*/)}))
	keyDeclaration := f.UpdateClassDeclaration(declared.AsClassDeclaration(), f.NewModifierList(classModifiers), declared.Name(), nil /*typeParameters*/, f.NewNodeList([]*ast.Node{extends}), f.NewNodeList(statics))

	result := []*ast.Node{shapeDeclaration, baseDeclaration, keyDeclaration}
	if isDefault {
		// The interface and the class merge only with the same export status,
		// so both stay local and the module exports the merged name.
		result = append(result, f.NewExportAssignment(nil /*modifiers*/, false /*isExportEquals*/, nil /*type*/, f.NewIdentifier(name)))
	}
	return result
}

// writtenShape returns the shape of a service of any shape (D281) as the
// declaration transform wrote it, the type argument of declared's extends
// clause $service<Type>, or nil when class declares another service.
func writtenShape(declared, class *ast.Node) *ast.Node {
	if serviceShape(class) == nil {
		return nil
	}
	if extends := ast.GetClassExtendsHeritageElement(declared); extends != nil {
		if arguments := extends.TypeArguments(); len(arguments) == 1 {
			return arguments[0]
		}
	}
	return nil
}
