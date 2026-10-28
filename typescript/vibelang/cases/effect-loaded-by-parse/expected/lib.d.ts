import { Effect } from "effect";
export declare const line: (asked: string) => Effect.Effect<any, SyntaxError, never>;
export declare const component: (text: string) => Effect.Effect<string, URIError, never>;
export declare const global: (text: string) => Effect.Effect<unknown, SyntaxError, never>;
