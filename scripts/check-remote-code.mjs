#!/usr/bin/env node
/**
 * MV3 / Chrome Web Store guard: fails when the built extension could load or
 * run code that is not in the package (remote scripts, remote imports) or
 * build code from strings (eval, new Function, string timers).
 *
 * Usage: node scripts/check-remote-code.mjs [dir]   (default .output/chrome-mv3)
 * Exit codes: 0 clean, 1 findings, 2 missing or empty build directory.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const QUOTE = `["'\`]`;
const RULES = [
  {
    name: 'remote <script src>',
    pattern: /<script\b[^>]*\bsrc\s*=\s*["']?\s*(?:https?:)?\/\//gi,
  },
  {
    name: 'remote dynamic import()',
    pattern: new RegExp(`\\bimport\\s*\\(\\s*${QUOTE}\\s*(?:https?:)?//`, 'g'),
  },
  {
    name: 'remote importScripts()',
    pattern: new RegExp(
      `\\bimportScripts\\s*\\([^)]*${QUOTE}\\s*(?:https?:)?//`,
      'g'
    ),
  },
  { name: 'eval()', pattern: /(?<![\w$])eval\s*\(/g },
  // Covers `new Function(...)` and the equivalent bare `Function(...)` call.
  { name: 'Function constructor', pattern: /(?<![\w$])Function\s*\(/g },
  {
    name: 'string passed to setTimeout/setInterval',
    pattern: new RegExp(
      `(?<![\\w$])set(?:Timeout|Interval)\\s*\\(\\s*${QUOTE}`,
      'g'
    ),
  },
];

function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return /\.(?:m?js|html)$/i.test(entry.name) ? [path] : [];
  });
}

/** 1-based line and column of a string offset. */
function position(text, offset) {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return { line, column: offset - before.lastIndexOf('\n') };
}

function excerpt(text, offset) {
  return text
    .slice(Math.max(0, offset - 40), offset + 60)
    .replace(/\s+/g, ' ')
    .trim();
}

function scan(dir) {
  const findings = [];
  const files = listFiles(dir);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const { name, pattern } of RULES) {
      for (const match of text.matchAll(pattern)) {
        const { line, column } = position(text, match.index);
        findings.push({
          file,
          line,
          column,
          name,
          excerpt: excerpt(text, match.index),
        });
      }
    }
  }
  return { files, findings };
}

const dir = resolve(process.argv[2] ?? '.output/chrome-mv3');
let isDirectory = false;
try {
  isDirectory = statSync(dir).isDirectory();
} catch {
  // Reported below.
}
if (!isDirectory) {
  console.error(
    `check-remote-code: ${dir} not found. Build the extension first.`
  );
  process.exit(2);
}

const { files, findings } = scan(dir);
if (files.length === 0) {
  console.error(`check-remote-code: no .js or .html files in ${dir}.`);
  process.exit(2);
}
findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
for (const f of findings) {
  const shown = relative(process.cwd(), f.file);
  console.error(
    `${shown.startsWith('..') ? f.file : shown}:${f.line}:${f.column}  ${f.name}  …${f.excerpt}…`
  );
}
if (findings.length > 0) {
  console.error(
    `check-remote-code: ${findings.length} finding(s). MV3 forbids remote code and string evaluation.`
  );
  process.exit(1);
}
console.log(`check-remote-code: ${files.length} files clean.`);
