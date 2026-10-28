package vibelang

import (
	"github.com/microsoft/TypeScript/tsc/internal/ast"
	"github.com/microsoft/TypeScript/tsc/internal/checker"
	"github.com/microsoft/TypeScript/tsc/internal/compiler"
	"github.com/microsoft/TypeScript/tsc/internal/core"
	"github.com/microsoft/TypeScript/tsc/internal/printer"
)

// The declaration file of a service or control class (design D45, D361).
// The declaration transform writes the class as it is in source:
//
//	export declare abstract class Users {
//	    abstract find(id: string): Effect.Effect<User, UserNotFound, never>;
//	    static readonly layer: Layer.Layer<Users, never, never>;
//	}
//
// TypeScript code that imports it must see what the checker sees in .vibe
// files: an interface for the identifier, which extends the shape and the
// runtime's brand for the key, merged with a class whose static side is a
// Context key, the runtime's ServiceKey, and a namespace that holds the
// shape:
//
//	import type { ServiceBrand } from "vibelang-runtime";
//	export interface Users extends Users.Shape, ServiceBrand<"app/users#Users"> {
//	}
//	declare const Users_base: import("vibelang-runtime").ServiceKey<Users, Users.Shape>;
//	export declare abstract class Users extends Users_base {
//	    static readonly layer: Layer.Layer<Users, never, never>;
//	}
//	export declare namespace Users {
//	    interface Shape {
//	        find(id: string): Effect.Effect<User, UserNotFound, never>;
//	    }
//	}
//
// A service with a static default extends ReferenceKey<Users.Shape> instead.
// A service of any shape (D281) names its shape in the namespace, type Shape
// = SearchApi, and its identifier extends the shape only where the shape is
// an object type: service Prefix: string writes interface Prefix extends
// ServiceBrand<"app/main#Prefix">. Where a member's type names a type Shape of
// the file, which the namespace's Shape would hide, the members go in a
// top-level interface with a fresh name, and the namespace aliases it.
//
// A control operation keeps one interface for its members and an optional
// brand, and its key's base is ServiceKey<Approval>. A class that implements
// a service in source checks against its shape, so its declaration writes
// implements Users.Shape.
//
// An error declaration's class gets its marker beside it (D407): a
// type-only member of a namespace that merges with the class, the runtime's
// ErrorBrand for the class's key:
//
//	export declare class NotFound extends NotFound_base<{ readonly id: string; }> {
//	    #private;
//	}
//	export declare namespace NotFound {
//	    type $error = ErrorBrand<"app/errors#NotFound">;
//	}
//
// A consumer of the declarations counts an arm over the class toward
// exhaustiveness only when the marker is there (match_closed.go). It is a
// namespace member, not an instance member, because a subclass does not
// inherit it: a TypeScript class that extends an error is not marked, and an
// error family's base and subclass do not give one property two types.
//
// A service in a namespace is written the same way inside the namespace's
// body, which is ambient, so nothing in it says declare. A body whose
// members are all exported carries no export modifiers, so the body gains
// them and an empty export, which keeps the base constant private. The base
// constant's name, and a shape interface's, is fresh (hygiene.go):
// Users_base$1 when the source spells Users_base.

func init() { compiler.RegisterDeclarationTransformerHook(serviceDeclarations) }

// serviceEmit is what the declaration transform needs to know about one
// service or control class.
type serviceEmit struct {
	key     string
	kind    classKind
	members bool // the identifier extends the shape
}

func serviceDeclarations(resolver printer.EmitResolver, file *ast.SourceFile) func(*ast.SourceFile) *ast.SourceFile {
	r, ok := resolver.(*checker.EmitResolver)
	if !ok || !isVibeLangFile(file) {
		return nil
	}
	emits := map[*ast.Node]*serviceEmit{}
	implemented := map[*ast.Node]bool{} // implements clause elements that name a service
	errorKeys := map[*ast.Node]string{} // error declarations, and the keys their markers carry
	r.WithChecker(func(c *checker.Checker) {
		s := servicesFor(c)
		var collect func(statements []*ast.Node)
		collect = func(statements []*ast.Node) {
			for _, statement := range statements {
				if form, _ := errorFormOf(statement); form != errorFormNone {
					errorKeys[statement] = s.key(statement)
				}
				switch kind := classKindOf(statement); kind {
				case serviceClass:
					emits[statement] = &serviceEmit{key: s.key(statement), kind: kind, members: serviceShape(statement) == nil || shapeHasMembers(c, s.shapeOf(statement))}
				case controlClass:
					emits[statement] = &serviceEmit{key: s.key(statement), kind: kind}
				default:
					if ast.IsClassDeclaration(statement) {
						for _, element := range ast.GetImplementsHeritageClauseElements(statement) {
							if serviceShapeOfIdentifier(c, c.GetTypeFromTypeNode(element)) != nil {
								implemented[element] = true
							}
						}
					}
				}
				if body := namespaceBlock(statement); body != nil {
					collect(body.Statements())
				}
			}
		}
		collect(file.Statements.Nodes)
	})
	if len(emits) == 0 && len(implemented) == 0 && len(errorKeys) == 0 {
		return nil
	}
	ec := resolver.EmitContext()
	return func(declarations *ast.SourceFile) *ast.SourceFile {
		e := &serviceEmitter{ec: ec, names: &freshNames{file: file}, emits: emits, implemented: implemented, errorKeys: errorKeys}
		statements, changed := e.statements(declarations.Statements.Nodes, false /*ambient*/)
		if !changed {
			return declarations
		}
		if len(e.brands) > 0 {
			// transformDeclarations, which runs next, imports the brand.
			r.WithChecker(func(c *checker.Checker) {
				state := preludeStateOf(c)
				for _, identifier := range e.brands {
					recordTypeUse(state, file, identifier)
				}
			})
		}
		list := ec.Factory.NewNodeList(statements)
		list.Loc = declarations.Statements.Loc
		return ec.Factory.UpdateSourceFile(declarations, list, declarations.EndOfFileToken).AsSourceFile()
	}
}

// serviceEmitter writes the declarations of the services of one file.
type serviceEmitter struct {
	ec          *printer.EmitContext
	names       *freshNames                // the names that declaration emit adds (hygiene.go)
	emits       map[*ast.Node]*serviceEmit // service and control classes, by source declaration
	implemented map[*ast.Node]bool         // implements clause elements that name a service
	errorKeys   map[*ast.Node]string       // error declarations, by source declaration, and their markers' keys
	brands      []*ast.Node                // the ServiceBrand and ErrorBrand identifiers it wrote
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

// statements returns statements, those of a declaration file or, when
// ambient, of a namespace's body, with each service and control class
// written as service and control write them, each class that implements a
// service written to implement its shape, in nested namespaces too, and
// whether any changed. In a body without an export declaration every member
// is exported, so when a service is written there, each member gains the
// export modifier it stands for, and an empty export keeps the statements
// that declaration emit adds, such as the base constant, private.
func (e *serviceEmitter) statements(statements []*ast.Node, ambient bool) ([]*ast.Node, bool) {
	allExported := ambient && !core.Some(statements, func(s *ast.Node) bool { return ast.IsExportDeclaration(s) || ast.IsExportAssignment(s) })
	var result []*ast.Node
	private := map[*ast.Node]bool{} // added statements that stay unexported
	changed := false
	for _, statement := range statements {
		class := e.ec.MostOriginal(statement)
		if emit := e.emits[class]; ast.IsClassDeclaration(statement) && emit != nil {
			exported := allExported || ast.HasSyntacticModifier(statement, ast.ModifierFlagsExport)
			var written, hidden []*ast.Node
			if emit.kind == serviceClass {
				written, hidden = e.service(statement, class, emit, ambient, exported)
			} else {
				written, hidden = e.control(statement, emit.key, ambient, exported)
			}
			for _, statement := range hidden {
				private[statement] = true
			}
			result = append(result, written...)
			changed = true
			continue
		}
		switch {
		case ast.IsClassDeclaration(statement) && (len(e.implemented) > 0 || e.errorKeys[class] != ""):
			if updated := e.implementShapes(statement); updated != statement {
				statement = updated
				changed = true
			}
			if key := e.errorKeys[class]; key != "" {
				exported := allExported || ast.HasSyntacticModifier(statement, ast.ModifierFlagsExport)
				result = append(result, e.errorMarker(statement, key, ambient, exported)...)
				changed = true
				continue
			}
		case ast.IsModuleDeclaration(statement):
			if namespace, ok := e.namespace(statement); ok {
				statement = namespace
				changed = true
			}
		}
		result = append(result, statement)
	}
	if len(private) == 0 || !allExported {
		return result, changed
	}
	f := e.ec.Factory.AsNodeFactory()
	for i, statement := range result {
		if private[statement] || !ast.CanHaveModifiers(statement) || ast.IsImportEqualsDeclaration(statement) {
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

// namespace returns namespace, a namespace declaration of a declaration
// file, with its body's statements written by statements, and whether any
// changed.
func (e *serviceEmitter) namespace(namespace *ast.Node) (*ast.Node, bool) {
	f := e.ec.Factory
	body := namespace.Body()
	switch {
	case body == nil:
		return namespace, false
	case ast.IsModuleDeclaration(body):
		inner, ok := e.namespace(body)
		if !ok {
			return namespace, false
		}
		body = inner
	case ast.IsModuleBlock(body):
		statements, ok := e.statements(body.Statements(), true /*ambient*/)
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

// declareModifiers returns declare, which a statement outside an ambient
// namespace body needs, after export when exported.
func declareModifiers(f *printer.NodeFactory, ambient, exported bool) []*ast.Node {
	var modifiers []*ast.Node
	if exported {
		modifiers = append(modifiers, f.NewModifier(ast.KindExportKeyword))
	}
	if !ambient {
		modifiers = append(modifiers, f.NewModifier(ast.KindDeclareKeyword))
	}
	return modifiers
}

// service returns the declarations of a service: declared, the class the
// declaration transform wrote for class, becomes an interface for its
// identifier, a `<Name>_base` constant typed with the runtime's key type, a
// class that extends it with the static members, and a namespace that holds
// the shape (D361). It also returns the declarations among them that stay
// unexported, the base constant and a shape's fresh interface. exported says
// whether the service is exported, and ambient that it is in a namespace's
// body, where nothing says declare.
func (e *serviceEmitter) service(declared, class *ast.Node, emit *serviceEmit, ambient, exported bool) ([]*ast.Node, []*ast.Node) {
	f := e.ec.Factory
	name := declared.Name().Text()
	isDefault := ast.HasSyntacticModifier(declared, ast.ModifierFlagsDefault)
	exported = exported && !isDefault
	instance, statics := splitMembers(f, declared)

	var result, hidden []*ast.Node
	var shape *ast.Node // the namespace's Shape
	if written := writtenShape(declared, class); written != nil {
		if mentionsName(written, serviceShapeName) {
			alias := e.names.freshName(name + "_" + serviceShapeName)
			aliasDeclaration := f.NewTypeAliasDeclaration(nil /*modifiers*/, f.NewIdentifier(alias), nil /*typeParameters*/, written)
			result, hidden = append(result, aliasDeclaration), append(hidden, aliasDeclaration)
			written = f.NewTypeReferenceNode(f.NewIdentifier(alias), nil /*typeArguments*/)
		}
		shape = f.NewTypeAliasDeclaration(nil /*modifiers*/, f.NewIdentifier(serviceShapeName), nil /*typeParameters*/, written)
	} else if slicesMentionName(instance, serviceShapeName) {
		members := e.names.freshName(name + "_" + serviceShapeName)
		membersDeclaration := f.NewInterfaceDeclaration(nil /*modifiers*/, f.NewIdentifier(members), nil /*typeParameters*/, nil /*heritageClauses*/, f.NewNodeList(instance))
		result, hidden = append(result, membersDeclaration), append(hidden, membersDeclaration)
		shape = f.NewTypeAliasDeclaration(nil /*modifiers*/, f.NewIdentifier(serviceShapeName), nil /*typeParameters*/, f.NewTypeReferenceNode(f.NewIdentifier(members), nil /*typeArguments*/))
	} else {
		shape = f.NewInterfaceDeclaration(nil /*modifiers*/, f.NewIdentifier(serviceShapeName), nil /*typeParameters*/, nil /*heritageClauses*/, f.NewNodeList(instance))
	}
	shapeOf := func() *ast.Node {
		return f.NewPropertyAccessExpression(f.NewIdentifier(name), nil /*questionDotToken*/, f.NewIdentifier(serviceShapeName), ast.NodeFlagsNone)
	}
	shapeType := func() *ast.Node {
		return f.NewTypeReferenceNode(f.NewQualifiedName(f.NewIdentifier(name), f.NewIdentifier(serviceShapeName)), nil /*typeArguments*/)
	}

	// interface Users extends Users.Shape, ServiceBrand<"app/users#Users"> {}
	var heritage []*ast.Node
	if emit.members {
		heritage = append(heritage, f.NewExpressionWithTypeArguments(shapeOf(), nil /*typeArguments*/))
	}
	brand := f.NewIdentifier(serviceBrandName)
	e.brands = append(e.brands, brand)
	heritage = append(heritage, f.NewExpressionWithTypeArguments(brand, f.NewNodeList([]*ast.Node{f.NewLiteralTypeNode(f.NewStringLiteral(emit.key, ast.TokenFlagsNone))})))
	identifier := f.NewInterfaceDeclaration(exportModifiers(f, exported), f.NewIdentifier(name), nil /*typeParameters*/, f.NewNodeList([]*ast.Node{f.NewHeritageClause(ast.KindExtendsKeyword, f.NewNodeList(heritage))}), f.NewNodeList(nil))

	keyType, keyArguments := "ServiceKey", []*ast.Node{f.NewTypeReferenceNode(f.NewIdentifier(name), nil /*typeArguments*/), shapeType()}
	if hasStaticDefault(class) {
		keyType, keyArguments = "ReferenceKey", keyArguments[1:]
	}
	base := keyBase(f, e.names.freshName(name+"_base"), keyType, keyArguments, ambient)
	result, hidden = append(result, identifier, base, keyClass(f, declared, base, ambient, exported, statics)), append(hidden, base)

	namespaceModifiers := declareModifiers(f, ambient, exported)
	result = append(result, f.NewModuleDeclaration(f.NewModifierList(namespaceModifiers), ast.KindNamespaceKeyword, f.NewIdentifier(name), nil /*attributes*/, f.NewModuleBlock(f.NewNodeList([]*ast.Node{shape}))))
	if isDefault {
		// The interface, the class, and the namespace merge only with the same
		// export status, so they stay local and the module exports the name.
		result = append(result, f.NewExportAssignment(nil /*modifiers*/, false /*isExportEquals*/, nil /*type*/, f.NewIdentifier(name)))
	}
	return result, hidden
}

// control returns the declarations of a control operation: an interface for
// its members and the optional brand, a `<Name>_base` constant typed with
// the runtime's ServiceKey, and a class that extends it with the static
// members.
func (e *serviceEmitter) control(declared *ast.Node, key string, ambient, exported bool) ([]*ast.Node, []*ast.Node) {
	f := e.ec.Factory
	name := declared.Name().Text()
	isDefault := ast.HasSyntacticModifier(declared, ast.ModifierFlagsDefault)
	exported = exported && !isDefault
	instance, statics := splitMembers(f, declared)
	instance = append(instance, f.NewPropertySignatureDeclaration(
		f.NewModifierList([]*ast.Node{f.NewModifier(ast.KindReadonlyKeyword)}),
		f.NewStringLiteral(serviceBrandProperty, ast.TokenFlagsNone),
		f.NewToken(ast.KindQuestionToken),
		f.NewLiteralTypeNode(f.NewStringLiteral(key, ast.TokenFlagsNone)),
		nil, /*initializer*/
	))
	shape := f.NewInterfaceDeclaration(exportModifiers(f, exported), f.NewIdentifier(name), nil /*typeParameters*/, nil /*heritageClauses*/, f.NewNodeList(instance))
	keyArguments := []*ast.Node{f.NewTypeReferenceNode(f.NewIdentifier(name), nil /*typeArguments*/)}
	base := keyBase(f, e.names.freshName(name+"_base"), "ServiceKey", keyArguments, ambient)
	result := []*ast.Node{shape, base, keyClass(f, declared, base, ambient, exported, statics)}
	if isDefault {
		result = append(result, f.NewExportAssignment(nil /*modifiers*/, false /*isExportEquals*/, nil /*type*/, f.NewIdentifier(name)))
	}
	return result, []*ast.Node{base}
}

// errorMarker returns declared, the class of an error declaration, and the
// namespace that marks it as one (D407), whose type-only member $error is
// ErrorBrand<key>. The namespace merges with the class only with the same
// export status, so the class of a default export stays local and the module
// exports the merged name. ambient says that it is in a namespace's body,
// where nothing says declare.
func (e *serviceEmitter) errorMarker(declared *ast.Node, key string, ambient, exported bool) []*ast.Node {
	f := e.ec.Factory
	name := declared.Name().Text()
	isDefault := ast.HasSyntacticModifier(declared, ast.ModifierFlagsDefault)
	exported = exported && !isDefault
	class := declared
	if isDefault {
		var modifiers []*ast.Node
		for _, modifier := range declared.ModifierNodes() {
			if modifier.Kind != ast.KindExportKeyword && modifier.Kind != ast.KindDefaultKeyword {
				modifiers = append(modifiers, modifier)
			}
		}
		data := declared.AsClassDeclaration()
		class = f.UpdateClassDeclaration(data, f.NewModifierList(modifiers), declared.Name(), declared.TypeParameterList(), data.HeritageClauses, declared.MemberList())
	}
	brand := f.NewIdentifier(errorBrandName)
	e.brands = append(e.brands, brand)
	brandType := f.NewTypeReferenceNode(brand, f.NewNodeList([]*ast.Node{f.NewLiteralTypeNode(f.NewStringLiteral(key, ast.TokenFlagsNone))}))
	member := f.NewTypeAliasDeclaration(nil /*modifiers*/, f.NewIdentifier(errorMarkerName), nil /*typeParameters*/, brandType)
	marker := f.NewModuleDeclaration(f.NewModifierList(declareModifiers(f, ambient, exported)), ast.KindNamespaceKeyword, f.NewIdentifier(name), nil /*attributes*/, f.NewModuleBlock(f.NewNodeList([]*ast.Node{member})))
	result := []*ast.Node{class, marker}
	if isDefault {
		result = append(result, f.NewExportAssignment(nil /*modifiers*/, false /*isExportEquals*/, nil /*type*/, f.NewIdentifier(name)))
	}
	return result
}

// splitMembers returns the instance members of declared as interface
// members, and its static members as they are.
func splitMembers(f *printer.NodeFactory, declared *ast.Node) (instance, statics []*ast.Node) {
	for _, member := range declared.Members() {
		switch {
		case ast.IsStatic(member):
			statics = append(statics, member)
		case ast.IsMethodDeclaration(member):
			instance = append(instance, f.NewMethodSignatureDeclaration(nil /*modifiers*/, member.Name(), member.PostfixToken(), member.TypeParameterList(), member.ParameterList(), member.Type()))
		case ast.IsPropertyDeclaration(member):
			var modifiers *ast.ModifierList
			if ast.HasSyntacticModifier(member, ast.ModifierFlagsReadonly) {
				modifiers = f.NewModifierList([]*ast.Node{f.NewModifier(ast.KindReadonlyKeyword)})
			}
			instance = append(instance, f.NewPropertySignatureDeclaration(modifiers, member.Name(), member.PostfixToken(), member.Type(), nil /*initializer*/))
		}
	}
	return instance, statics
}

// exportModifiers returns `export` when exported, and no modifiers otherwise.
func exportModifiers(f *printer.NodeFactory, exported bool) *ast.ModifierList {
	if !exported {
		return nil
	}
	return f.NewModifierList([]*ast.Node{f.NewModifier(ast.KindExportKeyword)})
}

// keyBase returns `declare const <base>: import("vibelang-runtime").<keyType><keyArguments>`,
// without declare when ambient.
func keyBase(f *printer.NodeFactory, base, keyType string, keyArguments []*ast.Node, ambient bool) *ast.Node {
	baseType := f.NewImportTypeNode(false /*isTypeOf*/, f.NewLiteralTypeNode(f.NewStringLiteral(runtimeModule, ast.TokenFlagsNone)), nil /*attributes*/, f.NewIdentifier(keyType), f.NewNodeList(keyArguments))
	return f.NewVariableStatement(
		f.NewModifierList(declareModifiers(f, ambient, false /*exported*/)),
		f.NewVariableDeclarationList(f.NewNodeList([]*ast.Node{f.NewVariableDeclaration(f.NewIdentifier(base), nil /*exclamationToken*/, baseType, nil /*initializer*/)}), ast.NodeFlagsConst),
	)
}

// keyClass returns the key class: declared, as an abstract class that
// extends the constant base declares, with only its static members.
func keyClass(f *printer.NodeFactory, declared, base *ast.Node, ambient, exported bool, statics []*ast.Node) *ast.Node {
	modifiers := append(declareModifiers(f, ambient, exported), f.NewModifier(ast.KindAbstractKeyword))
	name := base.AsVariableStatement().DeclarationList.AsVariableDeclarationList().Declarations.Nodes[0].Name().Text()
	extends := f.NewHeritageClause(ast.KindExtendsKeyword, f.NewNodeList([]*ast.Node{f.NewExpressionWithTypeArguments(f.NewIdentifier(name), nil /*typeArguments*/)}))
	return f.UpdateClassDeclaration(declared.AsClassDeclaration(), f.NewModifierList(modifiers), declared.Name(), nil /*typeParameters*/, f.NewNodeList([]*ast.Node{extends}), f.NewNodeList(statics))
}

// implementShapes returns class with each element of its implements clause
// that names a service, by the source element it came from, written as the
// service's shape: implements Users becomes implements Users.Shape (D361).
func (e *serviceEmitter) implementShapes(class *ast.Node) *ast.Node {
	f := e.ec.Factory
	clauses := class.ClassLikeData().HeritageClauses
	if clauses == nil {
		return class
	}
	changed := false
	var updated []*ast.Node
	for _, clause := range clauses.Nodes {
		if clause.AsHeritageClause().Token != ast.KindImplementsKeyword {
			updated = append(updated, clause)
			continue
		}
		var elements []*ast.Node
		for _, element := range clause.AsHeritageClause().Types.Nodes {
			if e.implemented[e.ec.MostOriginal(element)] {
				// Declaration emit writes an element as a type reference or as
				// the expression it was in source.
				switch {
				case ast.IsTypeReferenceNode(element):
					shape := f.NewQualifiedName(element.AsTypeReferenceNode().TypeName, f.NewIdentifier(serviceShapeName))
					element = f.NewTypeReferenceNode(shape, element.TypeArgumentList())
					changed = true
				case ast.IsExpressionWithTypeArguments(element):
					shape := f.NewPropertyAccessExpression(element.Expression(), nil /*questionDotToken*/, f.NewIdentifier(serviceShapeName), ast.NodeFlagsNone)
					element = f.NewExpressionWithTypeArguments(shape, element.TypeArgumentList())
					changed = true
				}
			}
			elements = append(elements, element)
		}
		updated = append(updated, f.NewHeritageClause(ast.KindImplementsKeyword, f.NewNodeList(elements)))
	}
	if !changed {
		return class
	}
	data := class.AsClassDeclaration()
	return f.UpdateClassDeclaration(data, class.Modifiers(), class.Name(), class.TypeParameterList(), f.NewNodeList(updated), class.MemberList())
}

// mentionsName reports whether node has an identifier whose text is name.
func mentionsName(node *ast.Node, name string) bool {
	var visit func(n *ast.Node) bool
	visit = func(n *ast.Node) bool {
		return ast.IsIdentifier(n) && n.Text() == name || n.ForEachChild(visit)
	}
	return visit(node)
}

// slicesMentionName reports whether any of nodes mentions name.
func slicesMentionName(nodes []*ast.Node, name string) bool {
	for _, node := range nodes {
		if mentionsName(node, name) {
			return true
		}
	}
	return false
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
