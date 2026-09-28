import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT = fileURLToPath(
  new URL('./check-remote-code.mjs', import.meta.url)
);

/** Each file holds one construct the guard must report. */
const REMOTE_SAMPLES = {
  'default-import.js': 'import x from "https://cdn.example/x.js";',
  'named-import.js': "import { a, b as c } from 'http://cdn.example/x.js';",
  'minified-import.js': 'import{a as b}from"https://cdn.example/x.js";b();',
  'namespace-import.js': 'import * as ns from `https://cdn.example/x.js`;',
  'mixed-import.js': 'import d, { e } from "https://cdn.example/x.js";',
  'multiline-import.js':
    'import {\n  a,\n  b,\n} from\n  "https://cdn.example/x.js";',
  'side-effect-import.js': 'import "https://cdn.example/polyfill.js";',
  'minified-side-effect.js': 'let a=1;import"https://cdn.example/p.js";',
  'protocol-relative-import.js': 'import x from "//cdn.example/x.js";',
  'protocol-relative-side-effect.js': "import'//cdn.example/x.js';",
  'uppercase-scheme.js': 'import x from "HTTPS://cdn.example/x.js";',
  'export-from.js': 'export { a } from "https://cdn.example/x.js";',
  'export-star.js': 'export*from"https://cdn.example/x.js";',
  'export-star-as.js': "export * as ns from '//cdn.example/x.js';",
  'dynamic-import.js': 'const m = import("https://cdn.example/x.js");',
  'inline-module.html':
    '<script type="module">import x from "https://cdn.example/x.js";</script>',
};

/** Look alike but load nothing remote: must stay clean. */
const CLEAN_SAMPLES = {
  'local-import.js':
    'import{a as b}from"./chunk-1.js";import"./polyfill.js";export*from"../x.js";',
  'extension-url.js': 'const m = import("chrome-extension://abc/x.js");',
  'string-url.js': 'const u = "https://example.com/"; fetch(u);',
  'array-from.js': 'export const xs = Array.from("https://example.com/");',
  'import-meta.js': 'const base = new URL("./a.js", import.meta.url);',
  'property-import.js': 'loader.import("https://example.com/data.json");',
  'from-identifier.js': 'const datafrom = 1; export { datafrom };',
};

let dirs = [];

function plant(samples) {
  const dir = mkdtempSync(join(tmpdir(), 'check-remote-code-'));
  dirs.push(dir);
  mkdirSync(join(dir, 'chunks'));
  for (const [name, source] of Object.entries(samples)) {
    writeFileSync(join(dir, 'chunks', name), source);
  }
  return dir;
}

function check(dir) {
  return spawnSync(process.execPath, [SCRIPT, dir], { encoding: 'utf8' });
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  dirs = [];
});

describe('check-remote-code', () => {
  it('reports every remote import or export form', () => {
    const result = check(plant({ ...REMOTE_SAMPLES, ...CLEAN_SAMPLES }));
    expect(result.status).toBe(1);
    const reported = new Set(
      result.stderr
        .split('\n')
        .map((line) => /([\w-]+\.(?:js|html)):\d+:\d+/.exec(line)?.[1])
        .filter(Boolean)
    );
    expect([...reported].sort()).toEqual(Object.keys(REMOTE_SAMPLES).sort());
  });

  it('passes a build with only local imports', () => {
    const result = check(plant(CLEAN_SAMPLES));
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails when the build directory is missing', () => {
    expect(check(join(tmpdir(), 'check-remote-code-missing')).status).toBe(2);
  });
});
