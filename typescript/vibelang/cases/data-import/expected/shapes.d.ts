import { Data, Effect } from "effect";
export declare const Shape: Data.TaggedEnum.Constructor<Shape>;
export type Shape = Data.TaggedEnum<{
    Circle: {
        readonly radius: number;
    };
    Square: {
        readonly side: number;
    };
    Dot: {};
}>;
export interface TreeDefinition extends Data.TaggedEnum.WithGenerics<1> {
    readonly taggedEnum: Tree<this["A"]>;
}
export declare const Tree: {
    readonly [Tag in TreeDefinition["taggedEnum"]["_tag"]]: <A>(args: Data.TaggedEnum.Args<Data.TaggedEnum.Kind<TreeDefinition, A>, Tag>) => Data.TaggedEnum.Value<Data.TaggedEnum.Kind<TreeDefinition, A>, Tag>;
} & Data.TaggedEnum.GenericMatchers<TreeDefinition>;
export type Tree<A> = Data.TaggedEnum<{
    Leaf: {
        readonly value: A;
    };
    Node: {
        readonly left: Tree<A>;
        readonly right: Tree<A>;
    };
}>;
export declare function area(shape: Shape): Effect.Effect<number, never, never>;
