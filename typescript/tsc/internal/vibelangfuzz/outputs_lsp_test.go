package vibelangfuzz

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

// D266 includes exclusive diagnostic ends in UTF-16. A small protocol peer
// tests the native-stock fallback's framed transport and Unicode conversion
// without installing a compiler or substituting compiler-produced expectations.
func TestOutputsLSPSpans(t *testing.T) {
	const peer = `#!/usr/bin/env node
const reject = REJECT;
let input = Buffer.alloc(0);
function send(value) {
 const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", ...value }));
 const message = Buffer.concat([Buffer.from("Content-Length: " + body.length + "\r\n\r\n"), body]);
 process.stdout.write(message.subarray(0, 9)); process.stdout.write(message.subarray(9));
}
process.stdin.on("data", chunk => {
 input = Buffer.concat([input, chunk]);
 for (;;) {
  const split = input.indexOf("\r\n\r\n"); if (split < 0) return;
  const size = Number(/Content-Length: (\d+)/i.exec(input.subarray(0, split).toString())[1]);
  if (input.length < split + 4 + size) return;
  const request = JSON.parse(input.subarray(split + 4, split + 4 + size)); input = input.subarray(split + 4 + size);
  if (request.method === "exit") { process.exit(0); }
  if (request.id === undefined) continue;
  if (request.method === "textDocument/diagnostic") {
   if (reject) send({ id: request.id, error: { code: -1, message: "diagnostic request rejected" } });
   else send({ id: request.id, result: { kind: "full", items: [{ source: "ts", code: "2322", severity: 1, range: { start: { line: 1, character: 13 }, end: { line: 1, character: 19 } } }] } });
  } else send({ id: request.id, result: request.method === "initialize" ? { capabilities: { diagnosticProvider: {} } } : null });
 }
});
`
	for _, reject := range []bool{false, true} {
		t.Run(map[bool]string{false: "diagnostic-end", true: "protocol-error"}[reject], func(t *testing.T) {
			dir := t.TempDir()
			const source = "// é😀\r\nexport const answer: number = 'no';\n"
			if err := writeInside(dir, "main.ts", source); err != nil {
				t.Fatal(err)
			}
			tsc := filepath.Join(dir, "tsc")
			flag := "false"
			if reject {
				flag = "true"
			}
			if err := os.WriteFile(tsc, []byte(strings.Replace(peer, "REJECT", flag, 1)), 0o700); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			spans, sourceOnly, err := stockSpans(ctx, tsc, dir, "main.ts")
			if reject {
				if err == nil || !strings.Contains(err.Error(), "diagnostic request rejected") {
					t.Fatalf("expected protocol error, got %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			start := UTF16Len(source[:strings.Index(source, "answer")])
			expected := stockSpan{File: "main.ts", Start: start, End: start + 6, Code: 2322, Category: "error"}
			if !sourceOnly || !slices.Equal(spans, []stockSpan{expected}) {
				t.Fatalf("expected native source span %v, got %v (sourceOnly=%v)", expected, spans, sourceOnly)
			}
		})
	}
}
