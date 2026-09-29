/**
 * Shared helpers for the i18n tooling (export, import, check, new, codemod).
 * Plain Node ESM without dependencies: locale files are read with a small
 * literal parser instead of a TypeScript compiler, so they must stay plain
 * `export default { key: 'string', ... } satisfies ...;` modules (the tools
 * write them that way). Prettier (a dev dependency) formats written files
 * when it is installed.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
);
export const SOURCE_LANGUAGE = 'en';
/** Export key prefix for Chrome's public/_locales messages. */
export const CHROME_NAMESPACE = '_locales';
export const PLURAL_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other'];
const PLURAL_KEY = /^(.+)_(zero|one|two|few|many|other)$/;
const APP_PLACEHOLDER = /\{(\w+)\}/g;
const CHROME_PLACEHOLDER = /\$(\w+)\$/g;

export class I18nToolError extends Error {
  /** @param {string} message @param {string[]} [details] */
  constructor(message, details = []) {
    super(
      details.length ? `${message}\n${details.map((d) => `  - ${d}`).join('\n')}` : message
    );
    this.name = 'I18nToolError';
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Paths

export function paths(root = REPO_ROOT) {
  return {
    root,
    i18n: join(root, 'src/i18n'),
    languagesFile: join(root, 'src/i18n/languages.ts'),
    locales: join(root, 'src/i18n/locales'),
    chromeLocales: join(root, 'src/public/_locales'),
  };
}

export function rel(root, file) {
  return relative(root, file).split('\\').join('/');
}

// ---------------------------------------------------------------------------
// Literal parser: objects, arrays, strings, numbers, booleans, null, with
// source spans so values can be replaced in place.

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * @typedef {{ type: 'string' | 'number' | 'boolean' | 'null', value: unknown, start: number, end: number }} ScalarNode
 * @typedef {{ key: string, keyStart: number, value: Node, end: number }} Entry
 *   `end` is just past the entry's trailing comma when it has one.
 * @typedef {{ type: 'object', entries: Entry[], start: number, end: number }} ObjectNode
 * @typedef {{ type: 'array', items: Node[], start: number, end: number }} ArrayNode
 * @typedef {ScalarNode | ObjectNode | ArrayNode} Node
 */

/** Parses the literal starting at `index` (after whitespace/comments). */
export function parseLiteral(source, index = 0, file = '<source>') {
  let pos = index;

  const fail = (message) => {
    const line = source.slice(0, pos).split('\n').length;
    throw new I18nToolError(`${file}:${line}: ${message}`);
  };

  const skipTrivia = () => {
    for (;;) {
      const ch = source[pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        pos++;
      } else if (source.startsWith('//', pos)) {
        const next = source.indexOf('\n', pos);
        pos = next === -1 ? source.length : next + 1;
      } else if (source.startsWith('/*', pos)) {
        const close = source.indexOf('*/', pos + 2);
        if (close === -1) fail('unterminated comment');
        pos = close + 2;
      } else {
        return;
      }
    }
  };

  const parseString = () => {
    const quote = source[pos];
    pos++;
    let out = '';
    for (;;) {
      if (pos >= source.length) fail('unterminated string');
      const ch = source[pos];
      if (ch === quote) {
        pos++;
        return out;
      }
      if (quote === '`' && ch === '$' && source[pos + 1] === '{') {
        fail('template literals with ${} are not supported in messages');
      }
      if ((ch === '\n' || ch === '\r') && quote !== '`') fail('newline in string');
      if (ch !== '\\') {
        out += ch;
        pos++;
        continue;
      }
      const esc = source[pos + 1];
      pos += 2;
      switch (esc) {
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'b': out += '\b'; break;
        case 'f': out += '\f'; break;
        case 'v': out += '\v'; break;
        case '0': out += '\0'; break;
        case '\r':
          if (source[pos] === '\n') pos++;
          break;
        case '\n':
        case '\u2028':
        case '\u2029':
          break;
        case 'x': {
          const hex = source.slice(pos, pos + 2);
          if (!/^[0-9a-fA-F]{2}$/.test(hex)) fail('bad \\x escape');
          out += String.fromCharCode(parseInt(hex, 16));
          pos += 2;
          break;
        }
        case 'u': {
          if (source[pos] === '{') {
            const close = source.indexOf('}', pos);
            const hex = source.slice(pos + 1, close);
            if (close === -1 || !/^[0-9a-fA-F]{1,6}$/.test(hex)) fail('bad \\u{} escape');
            out += String.fromCodePoint(parseInt(hex, 16));
            pos = close + 1;
          } else {
            const hex = source.slice(pos, pos + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('bad \\u escape');
            out += String.fromCharCode(parseInt(hex, 16));
            pos += 4;
          }
          break;
        }
        case undefined:
          fail('unterminated string');
          break;
        default:
          out += esc;
      }
    }
  };

  const parseKey = () => {
    const ch = source[pos];
    if (ch === "'" || ch === '"') return parseString();
    const match = /^[A-Za-z_$][\w$]*/.exec(source.slice(pos, pos + 200));
    if (!match) fail('expected a property name');
    pos += match[0].length;
    return match[0];
  };

  /** @returns {Node} */
  const parseValue = () => {
    skipTrivia();
    const start = pos;
    const ch = source[pos];
    if (ch === '{') {
      pos++;
      /** @type {Entry[]} */
      const entries = [];
      for (;;) {
        skipTrivia();
        if (source[pos] === '}') {
          pos++;
          return { type: 'object', entries, start, end: pos };
        }
        const keyStart = pos;
        const key = parseKey();
        skipTrivia();
        if (source[pos] !== ':') fail(`expected ":" after ${key}`);
        pos++;
        const value = parseValue();
        const entry = { key, keyStart, value, end: value.end };
        entries.push(entry);
        skipTrivia();
        if (source[pos] === ',') {
          pos++;
          entry.end = pos;
        } else if (source[pos] !== '}') {
          fail('expected "," or "}"');
        }
      }
    }
    if (ch === '[') {
      pos++;
      const items = [];
      for (;;) {
        skipTrivia();
        if (source[pos] === ']') {
          pos++;
          return { type: 'array', items, start, end: pos };
        }
        items.push(parseValue());
        skipTrivia();
        if (source[pos] === ',') pos++;
        else if (source[pos] !== ']') fail('expected "," or "]"');
      }
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const value = parseString();
      return { type: 'string', value, start, end: pos };
    }
    const word = /^(?:true|false|null|-?\d+(?:\.\d+)?)/.exec(source.slice(pos, pos + 40));
    if (word) {
      pos += word[0].length;
      const text = word[0];
      if (text === 'null') return { type: 'null', value: null, start, end: pos };
      if (text === 'true' || text === 'false') {
        return { type: 'boolean', value: text === 'true', start, end: pos };
      }
      return { type: 'number', value: Number(text), start, end: pos };
    }
    fail('expected a literal value');
    return undefined;
  };

  return parseValue();
}

/** Plain JS value of a parsed node. */
export function toValue(node) {
  if (node.type === 'object') {
    return Object.fromEntries(node.entries.map((e) => [e.key, toValue(e.value)]));
  }
  if (node.type === 'array') return node.items.map(toValue);
  return node.value;
}

/** The literal assigned to `export const <name>` in a module source. */
export function readExportedConst(source, name, file) {
  const match = new RegExp(`export const ${name}\\b[^=]*=`).exec(source);
  if (!match) throw new I18nToolError(`${file}: no "export const ${name}"`);
  return parseLiteral(source, match.index + match[0].length, file);
}

// ---------------------------------------------------------------------------
// Languages (src/i18n/languages.ts)

/**
 * @typedef {{ code: string, nativeName: string, englishName: string, intlLocale: string,
 *   chromeLocale: string, defaultCurrency: string, dayPickerLocale: string }} LanguageInfo
 * @returns {{ enabled: string[], info: Record<string, LanguageInfo>, drafts: Record<string, LanguageInfo> }}
 */
export function readLanguages(root = REPO_ROOT) {
  const file = paths(root).languagesFile;
  const source = readFileSync(file, 'utf8');
  const name = rel(root, file);
  const enabled = toValue(readExportedConst(source, 'APP_LANGUAGES', name));
  const info = toValue(readExportedConst(source, 'LANGUAGE_INFO', name));
  const drafts = toValue(readExportedConst(source, 'DRAFT_LANGUAGE_INFO', name));
  return { enabled, info, drafts };
}

/** Enabled or draft language info, or an error naming the next step. */
export function languageInfo(languages, lang) {
  const info = languages.info[lang] ?? languages.drafts[lang];
  if (!info) {
    throw new I18nToolError(
      `Unknown language "${lang}". Enabled: ${languages.enabled.join(', ')}. ` +
        `Start a new one with: pnpm i18n:new ${lang}`
    );
  }
  return info;
}

// ---------------------------------------------------------------------------
// Locale files (src/i18n/locales/<lang>/<namespace>.ts)

export function localeDir(root, lang) {
  return join(paths(root).locales, lang);
}

/** Namespace names of a locale folder (sorted), from its <ns>.ts files. */
export function namespaceFiles(root, lang) {
  const dir = localeDir(root, lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'))
    .map((f) => f.slice(0, -3))
    .sort();
}

/**
 * @returns {{ file: string, source: string, node: ObjectNode, messages: Record<string, string>, header: string }}
 */
export function readNamespaceFile(file, root = REPO_ROOT) {
  const source = readFileSync(file, 'utf8');
  const name = rel(root, file);
  const marker = source.indexOf('export default');
  if (marker === -1) throw new I18nToolError(`${name}: no "export default"`);
  const node = parseLiteral(source, marker + 'export default'.length, name);
  if (node.type !== 'object') throw new I18nToolError(`${name}: default export is not an object`);
  const messages = {};
  for (const entry of node.entries) {
    if (entry.value.type !== 'string') {
      throw new I18nToolError(`${name}: ${entry.key} is not a string literal`);
    }
    if (entry.key in messages) throw new I18nToolError(`${name}: duplicate key ${entry.key}`);
    messages[entry.key] = entry.value.value;
  }
  return { file, source, node, messages, header: headerComment(source.slice(0, marker)) };
}

/** The doc comment right before `export default`, if any. */
function headerComment(prefix) {
  const match = /(\/\*\*[\s\S]*?\*\/)\s*$/.exec(prefix);
  return match ? match[1] : '';
}

/**
 * All namespaces of one language. Missing folder -> empty.
 * @returns {{ namespaces: Record<string, Record<string, string>>, files: Record<string, ReturnType<typeof readNamespaceFile>> }}
 */
export function readLocale(root, lang) {
  const namespaces = {};
  const files = {};
  for (const ns of namespaceFiles(root, lang)) {
    const parsed = readNamespaceFile(join(localeDir(root, lang), `${ns}.ts`), root);
    files[ns] = parsed;
    namespaces[ns] = parsed.messages;
  }
  return { namespaces, files };
}

// ---------------------------------------------------------------------------
// Chrome messages (src/public/_locales/<chromeLocale>/messages.json)

export function chromeMessagesFile(root, chromeLocale) {
  return join(paths(root).chromeLocales, chromeLocale, 'messages.json');
}

/** @returns {Record<string, { message: string, description?: string }> | null} */
export function readChromeMessages(root, chromeLocale) {
  const file = chromeMessagesFile(root, chromeLocale);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new I18nToolError(`${rel(root, file)}: invalid JSON (${error.message})`);
  }
}

export function chromeLocaleFolders(root) {
  const dir = paths(root).chromeLocales;
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory()).sort();
}

// ---------------------------------------------------------------------------
// Placeholders and plurals

/** Placeholder names in order of appearance, repeats included. */
export function placeholders(message, namespace) {
  const pattern = namespace === CHROME_NAMESPACE ? CHROME_PLACEHOLDER : APP_PLACEHOLDER;
  return [...String(message).matchAll(pattern)].map((m) => m[1]);
}

/** Same placeholders, compared as sorted lists (the completeness test's rule). */
export function samePlaceholders(a, b) {
  const x = [...a].sort();
  const y = [...b].sort();
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

export function splitPluralKey(key) {
  const match = PLURAL_KEY.exec(key);
  return match ? { base: match[1], category: match[2] } : null;
}

/** Plural categories the language's Intl.PluralRules can return. */
export function pluralCategories(intlLocale) {
  return new Intl.PluralRules(intlLocale).resolvedOptions().pluralCategories;
}

/** Base keys of a namespace that have an `_other` form (tn() keys). */
export function pluralBases(messages) {
  return Object.keys(messages)
    .map(splitPluralKey)
    .filter((p) => p && p.category === 'other')
    .map((p) => p.base);
}

/**
 * Keys a language must have in a namespace: English's keys plus, for every
 * plural base, a form for each category the language uses (e.g. `_few` in
 * Russian), in English order with extra forms after their `_other`.
 */
export function requiredKeys(enMessages, intlLocale) {
  const categories = pluralCategories(intlLocale);
  const keys = [];
  for (const key of Object.keys(enMessages)) {
    keys.push(key);
    const plural = splitPluralKey(key);
    if (plural?.category !== 'other') continue;
    for (const category of categories) {
      const form = `${plural.base}_${category}`;
      if (!(form in enMessages)) keys.push(form);
    }
  }
  return keys;
}

/** Keys a language may have: required ones plus any plural form of a base. */
export function isAllowedKey(enMessages, key) {
  if (key in enMessages) return true;
  const plural = splitPluralKey(key);
  return Boolean(plural && `${plural.base}_other` in enMessages);
}

/** English text a (possibly extra) plural form is translated from. */
export function sourceText(enMessages, key) {
  if (key in enMessages) return enMessages[key];
  const plural = splitPluralKey(key);
  return plural ? enMessages[`${plural.base}_other`] : undefined;
}

// ---------------------------------------------------------------------------
// Rendering and writing

const RESERVED = new Set(
  (
    'break case catch class const continue debugger default delete do else enum export ' +
    'extends false finally for function if import in instanceof new null return super ' +
    'switch this throw true try typeof var void while with yield let static implements ' +
    'interface package private protected public await'
  ).split(' ')
);

export function propertyKey(key) {
  return IDENTIFIER.test(key) ? key : JSON.stringify(key);
}

export function quote(value) {
  // Prettier turns these into single quotes where that needs fewer escapes.
  return JSON.stringify(value);
}

/** Local identifier for a namespace import (`export` -> `exportMessages`). */
export function namespaceIdentifier(ns) {
  return RESERVED.has(ns) || !IDENTIFIER.test(ns) ? `${ns.replace(/\W/g, '_')}Messages` : ns;
}

function typeImport(lang) {
  return lang === SOURCE_LANGUAGE
    ? "import type { MessageTable } from '../../define';"
    : "import type { LocaleMessages } from '../../define';";
}

/**
 * Source of a namespace file (formatted later by prettier). English files may
 * pin their key set to a domain type (`englishType`, e.g.
 * `Record<ColorTheme, string>`) with the imports it needs.
 */
export function renderNamespaceFile(
  lang,
  ns,
  entries,
  { header = '', imports = [], englishType } = {}
) {
  const english = lang === SOURCE_LANGUAGE;
  const type = english ? (englishType ?? 'MessageTable') : `LocaleMessages[${quote(ns)}]`;
  const importLines = english && englishType ? imports : [typeImport(lang)];
  const body = entries.map(([key, value]) => `  ${propertyKey(key)}: ${quote(value)},`).join('\n');
  return `${importLines.join('\n')}\n\n${header ? `${header}\n` : ''}export default {\n${body}\n} satisfies ${type};\n`;
}

/** Source of locales/<lang>/index.ts, which gathers every namespace. */
export function renderIndexFile(lang, namespaces) {
  const imports = namespaces
    .map((ns) => `import ${namespaceIdentifier(ns)} from './${ns}';`)
    .join('\n');
  const props = namespaces
    .map((ns) => {
      const id = namespaceIdentifier(ns);
      return id === ns ? `  ${ns},` : `  ${propertyKey(ns)}: ${id},`;
    })
    .join('\n');
  const english = lang === SOURCE_LANGUAGE;
  const doc = english
    ? '/**\n * English: the source of truth for every locale\'s keys, bundled eagerly as\n * the per-key fallback. Generated layout; see docs/v2/I18N.md.\n */'
    : `/** ${lang} messages, loaded on demand. Generated layout; see docs/v2/I18N.md. */`;
  const type = english ? 'Record<string, MessageTable>' : 'LocaleMessages';
  return `${typeImport(lang)}\n${imports}\n\n${doc}\nexport default {\n${props}\n} satisfies ${type};\n`;
}

/**
 * Replaces changed values and inserts missing keys of a namespace file in
 * place, keeping comments and untouched lines. `wanted` is [key, value][] in
 * the desired order; keys not in it are left alone.
 */
export function patchNamespaceSource(parsed, wanted) {
  const { source, node } = parsed;
  const byKey = new Map(node.entries.map((e) => [e.key, e]));
  /** @type {{ start: number, end: number, text: string }[]} */
  const edits = [];
  let anchor = null; // entry after which a missing key is inserted
  const pendingInserts = new Map(); // anchor end -> text[]
  for (const [key, value] of wanted) {
    const existing = byKey.get(key);
    if (existing) {
      if (existing.value.value !== value) {
        edits.push({ start: existing.value.start, end: existing.value.end, text: quote(value) });
      }
      anchor = existing;
      continue;
    }
    const at = anchor ? anchor.end : node.start + 1;
    const needsComma = anchor && source[anchor.end - 1] !== ',';
    const list = pendingInserts.get(at) ?? { needsComma, lines: [] };
    list.lines.push(`\n  ${propertyKey(key)}: ${quote(value)},`);
    pendingInserts.set(at, list);
  }
  for (const [at, { needsComma, lines }] of pendingInserts) {
    edits.push({ start: at, end: at, text: `${needsComma ? ',' : ''}${lines.join('')}` });
  }
  edits.sort((a, b) => b.start - a.start);
  let out = source;
  for (const edit of edits) out = out.slice(0, edit.start) + edit.text + out.slice(edit.end);
  return out;
}

let prettierModule;
/** Formats with the repo's prettier config; returns the input if prettier is missing. */
export async function formatSource(file, source) {
  if (prettierModule === undefined) {
    try {
      prettierModule = await import('prettier');
    } catch {
      prettierModule = null;
      console.warn('[i18n] prettier is not installed; writing unformatted files');
    }
  }
  if (!prettierModule) return source;
  const options = (await prettierModule.resolveConfig(file)) ?? {};
  return prettierModule.format(source, { ...options, filepath: file });
}

/** Formats and writes `source` unless the file already has that content. */
export async function writeFormatted(file, source) {
  const formatted = await formatSource(file, source);
  if (existsSync(file) && readFileSync(file, 'utf8') === formatted) return false;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, formatted);
  return true;
}

// ---------------------------------------------------------------------------
// CLI helpers

/** Parses `--name value` / `--flag` options and positional arguments. */
export function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }
    const [name, inline] = arg.slice(2).split(/=(.*)/s);
    if (inline !== undefined) options[name] = inline;
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) options[name] = argv[++i];
    else options[name] = true;
  }
  return { positional, options };
}

/** True when the module at `moduleUrl` is the script Node was started with. */
export function isMain(moduleUrl) {
  return (
    process.argv[1] !== undefined &&
    moduleUrl === pathToFileURL(resolve(process.argv[1])).href
  );
}

/** Runs a CLI main, printing I18nToolError messages without a stack. */
export function runCli(main) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code ?? 0;
    },
    (error) => {
      if (error instanceof I18nToolError) console.error(`[i18n] ${error.message}`);
      else console.error(error);
      process.exitCode = 1;
    }
  );
}
