import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { $is, TaggedError } from "vibelang-runtime";
import * as Effect_1 from "effect/Effect";
import * as runtime from "vibelang-runtime";
export class NotFound extends TaggedError("NotFound") {
}
export class Timeout extends TaggedError("Timeout") {
}
export class Denied extends TaggedError("Denied") {
}
// After return.
export function phaseLabel(phase) {
    {
        const $match2 = phase;
        {
            if ($match2
                === "draft") {
                return "Draft";
            }
        }
        {
            if ($match2
                === "review") {
                return "Review";
            }
        }
        {
            {
                runtime.$assertMatch($match2
                    === "published", $match2);
                return "Published";
            }
        }
    }
}
// Inside an expression, where the match runs in its own function.
export function width(phase) {
    const label = (() => {
        const $match3 = phase;
        {
            if ($match3
                === "draft") {
                return 5;
            }
        }
        {
            if ($match3
                === "review") {
                return 6;
            }
        }
        {
            {
                runtime.$assertMatch($match3
                    === "published", $match3);
                return 9;
            }
        }
    })();
    return label;
}
export function record$direct(phase, log) {
    $match5: {
        const $match6 = phase;
        {
            if ($match6
                === "draft") {
                log.push("draft");
                break $match5;
            }
        }
        {
            if ($match6
                === "review") {
                log.push("review");
                break $match5;
            }
        }
        {
            {
                runtime.$assertMatch($match6
                    === "published", $match6);
                log.push("published");
                break $match5;
            }
        }
    }
}
// As a statement.
export function record(...args) { return runtime.$plainSync(record$direct, this, args); }
record[runtime.$direct] = record$direct;
export function describe$direct(failure) {
    {
        const $match8 = failure;
        {
            if ($is(NotFound, $match8) && (typeof $match8 === "function" || typeof $match8 === "object") && $match8
                !== null && "id" in
                $match8) {
                let id = $match8.id;
                return `no user ${id}`;
            }
        }
        {
            if ($is(Timeout, $match8)) {
                return "retry";
            }
        }
        {
            {
                runtime.$assertMatch($is(Denied, $match8) && (typeof $match8 === "function" || typeof $match8 === "object") && $match8
                    !== null && "user" in
                    $match8, $match8);
                let user = $match8.user;
                return `denied ${user}`;
            }
        }
    }
}
// The last arm still binds user and n.
export function describe(...args) { return runtime.$plainSync(describe$direct, this, args); }
describe[runtime.$direct] = describe$direct;
export function greeting$direct(name) {
    {
        const $match10 = name;
        {
            if (Option.isNone($match10)) {
                return "Hello";
            }
        }
        {
            {
                runtime.$assertMatch(Option.isSome($match10), $match10);
                let n = $match10.value;
                return `Hello, ${n}`;
            }
        }
    }
}
export function greeting(...args) { return runtime.$plainSync(greeting$direct, this, args); }
greeting[runtime.$direct] = greeting$direct;
// In an Effect function, whose arms run Effects.
export function announce(arg_1) {
    return Effect_1.fnUntraced(function* announce(phase) {
        $match12: {
            const $match13 = phase;
            {
                if ($match13
                    === "draft") {
                    yield* Effect.log("draft");
                    break $match12;
                }
            }
            {
                if ($match13
                    === "review") {
                    yield* Effect.log("review");
                    break $match12;
                }
            }
            {
                {
                    runtime.$assertMatch($match13
                        === "published", $match13);
                    yield* Effect.log("published");
                    break $match12;
                }
            }
        }
        return phase;
    }).apply(this, arguments);
}
