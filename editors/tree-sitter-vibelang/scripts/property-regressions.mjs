// Minimal parser-agreement regressions. --lib tests an unmodified parser.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const grammar = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scratch = mkdtempSync(join(tmpdir(), 'vibe-property-'));
const lib = process.argv.indexOf('--lib');
const parser = lib < 0 ? [] : ['--lib-path', resolve(process.argv[lib + 1]), '--lang-name', 'vibe'];
const cases = readdirSync(join(grammar, 'test/parser-agreement-regressions')).sort().map(name =>
  JSON.parse(readFileSync(join(grammar, 'test/parser-agreement-regressions', name), 'utf8')));
let failed = 0;
try {
  for (const {name, source, accepted, shape} of cases) {
    const path = join(scratch, name + '.vibe');
    writeFileSync(path, source + '\n');
    const result = spawnSync(join(grammar, 'node_modules/.bin/tree-sitter'), ['parse', ...parser, path], {cwd: grammar, encoding: 'utf8'});
    try {
      assert.equal(result.error, undefined);
      assert.match(result.stdout, /^\((program|ERROR)\b/, result.stderr);
      assert.equal(!/\((ERROR|MISSING)\b/.test(result.stdout), accepted, result.stdout);
      if (shape) assert.match(result.stdout, new RegExp(shape));
      console.log('PASS ' + name);
    } catch (error) {
      failed++;
      console.error('FAIL ' + name + ': ' + error.message);
    }
  }
} finally { rmSync(scratch, {recursive: true, force: true}); }
process.exitCode = failed ? 1 : 0;
