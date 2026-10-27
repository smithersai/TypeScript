function f(value: unknown) { {
    const $match2 = value;
    {
        if ($match2 === 1) {
            return "one";
        }
    }
    {
        if ($is(String, $match2)) {
            let text = $match2;
            return text;
        }
    }
    return "other";
} }
