package checker

import "github.com/microsoft/TypeScript/tsc/internal/ast"

// ClassBaseHook can choose the bases of class, a class's declared type. It
// returns the base constructor type, whose properties the class's static
// side inherits, and the base instance type, whose members the class's
// instances inherit, or nil and nil when it has nothing to say. A class whose
// bases a hook chooses ignores its own extends clause, if it has one, and
// keeps its own construct signatures, so the base constructor type must have
// none.
type ClassBaseHook func(c *Checker, class *Type) (constructorType *Type, instanceType *Type)

var classBaseHooks []ClassBaseHook

// RegisterClassBaseHook adds hook to every checker. Call it only from the
// init function of an in-tree package that tsc/cmd/tsc imports; registration
// is not synchronized.
func RegisterClassBaseHook(hook ClassBaseHook) {
	classBaseHooks = append(classBaseHooks, hook)
}

func (c *Checker) classBasesFromHooks(class *Type) (constructorType *Type, instanceType *Type) {
	for _, hook := range classBaseHooks {
		if constructorType, instanceType = hook(c, class); constructorType != nil {
			return constructorType, instanceType
		}
	}
	return nil, nil
}

// Program returns the program that c checks.
func (c *Checker) Program() Program {
	return c.program
}

// GetStringLiteralType returns the string literal type of value.
func (c *Checker) GetStringLiteralType(value string) *Type {
	return c.getStringLiteralType(value)
}

// NewOptionalReadonlyPropertyType returns the object type
// `{ readonly [name]?: t }`.
func (c *Checker) NewOptionalReadonlyPropertyType(name string, t *Type) *Type {
	property := c.newSymbolEx(ast.SymbolFlagsProperty|ast.SymbolFlagsOptional, name, ast.CheckFlagsReadonly)
	c.valueSymbolLinks.Get(property).resolvedType = t
	return c.newAnonymousType(nil, ast.SymbolTable{name: property}, nil, nil, nil)
}

// InitializerContextualTypeHook supplies an initializer's contextual type when
// its declaration has no written annotation. It returns nil for other declarations.
type InitializerContextualTypeHook func(c *Checker, declaration *ast.Node) *Type

var initializerContextualTypeHooks []InitializerContextualTypeHook

// RegisterInitializerContextualTypeHook registers an in-tree extension at init.
func RegisterInitializerContextualTypeHook(hook InitializerContextualTypeHook) {
	initializerContextualTypeHooks = append(initializerContextualTypeHooks, hook)
}

func (c *Checker) initializerContextualTypeFromHooks(declaration *ast.Node) *Type {
	for _, hook := range initializerContextualTypeHooks {
		if t := hook(c, declaration); t != nil {
			return t
		}
	}
	return nil
}

// CheckExpressionAssignableTo checks an implementation against a supplied
// shape, retaining TypeScript's member-level explanation of a mismatch.
func (c *Checker) CheckExpressionAssignableTo(node *ast.Node, target *Type) {
	c.checkTypeAssignableToAndOptionallyElaborate(c.checkExpressionCached(node), target, node, node, nil, nil)
}
