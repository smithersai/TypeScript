package vibelangfuzz

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"sync"
)

// The specification is the oracle. These facts are read from
// docs/design/src at test time, never copied into Go, so a specification
// change reaches every target without an edit here.

// SpecPath returns the path of a specification chapter, such as
// "428-part4-ch28-tooling.md".
func SpecPath(chapter string) string {
	return filepath.Join(Root(), "docs/design/src", chapter)
}

// SpecText returns a chapter's text. It panics when the chapter is missing:
// a target without its oracle must not pass.
func SpecText(chapter string) string {
	data, err := os.ReadFile(SpecPath(chapter))
	if err != nil {
		panic(err)
	}
	return string(data)
}

// SpecCodes returns every EK code in Chapter 28's registry table, in order.
var SpecCodes = sync.OnceValue(func() []int32 {
	return specCodes(`(?m)^\| EK(\d{4}) \|`)
})

// SpecListedCodes returns the codes Chapter 28 lists after its table, in
// order: "These codes are rules of the language as the table's are".
var SpecListedCodes = sync.OnceValue(func() []int32 {
	return specCodes(`(?m)^- \*\*EK(\d{4})\*\*`)
})

func specCodes(pattern string) []int32 {
	var codes []int32
	for _, m := range regexp.MustCompile(pattern).FindAllStringSubmatch(SpecText("428-part4-ch28-tooling.md"), -1) {
		code, _ := strconv.Atoi(m[1])
		if !slices.Contains(codes, int32(code)) {
			codes = append(codes, int32(code))
		}
	}
	return codes
}

// SpecHasCode reports whether Chapter 28 registers the code, in its table or
// in the list after it.
func SpecHasCode(code int32) bool {
	return slices.Contains(SpecCodes(), code) || slices.Contains(SpecListedCodes(), code)
}
