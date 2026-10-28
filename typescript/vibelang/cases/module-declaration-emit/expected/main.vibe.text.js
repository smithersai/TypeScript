import { more, twice } from "./more.js";
export { twice as double } from "./more.js";
export * as moreModule from "./more.js";
export var Mode;
(function (Mode) {
    Mode[Mode["Trim"] = 0] = "Trim";
    Mode[Mode["Upper"] = 1] = "Upper";
})(Mode || (Mode = {}));
export function clean(value, mode = Mode.Trim) {
    const trimmed = value.trim();
    return mode === Mode.Upper ? trimmed.toUpperCase() : twice(trimmed);
}
export function area(shape) {
    return shape.width * shape.height;
}
const label = `${more}:`;
export { label as prefix };
export default class {
    count = 0;
    increment() {
        return ++this.count;
    }
}
