/**
 * Circle (seller) name: labeled in the post ("서클명: …", "サークル名：…",
 * "社團：…", "Circle: …") or derived from the author's display name.
 */
import { findBoothCandidates } from './booth';
import { NAME_NOTE_WORDS } from './dictionaries';
import { detectEvents } from './events';
import { collapseSpaces, escapeRegExp, normalizeText, stripEmoji } from './normalize';
import { detectDay } from './signals';

const MAX_NAME_LENGTH = 40;

const CIRCLE_LABEL_RE = new RegExp(
  '(?<![\\p{L}\\p{N}])' +
    '(?:서클\\s?명|서클\\s?이름|서클|サークル名|サークル|社團名稱|社團名|社團|社团名称|社团名|社团|攤名|摊名|circle\\s?name|circle)' +
    '\\s?[:=]\\s?([^\\n]+)',
  'iu'
);
const CIRCLE_QUOTED_RE = /サークル\s?[「『]([^」』\n]{1,40})[」』]/u;

/** Where a labeled value ends: separators or the next label. */
const VALUE_END = new RegExp(
  '\\s*[/|,、;]\\s*|\\s{2,}|\\s+-\\s+|' +
    '(?<![\\p{L}\\p{N}])(?:부스|스페이스|booth|table|space|スペース|配置|摊位|攤位|이벤트|행사|event|イベント|場次|场次|參加|参加)',
  'iu'
);
const POLITE_END = /(?:입니다|이에요|예요|です|だよ|でーす)$/u;
const NOTE_RE = new RegExp(NAME_NOTE_WORDS.map(escapeRegExp).join('|'), 'iu');
const TAG_BRACKETS = /[[【〔〖][^\]】〕〗]*[\]】〕〗]/gu;
const PARENS = /\(([^()]*)\)/gu;
const SEPARATORS = /\s*[|/]\s*|\s+-\s+/u;
/** "(she/her)", "(they/them)", "(any pronouns)" in English display names. */
const PRONOUNS = /\/|\bpronouns?\b|^(?:he|she|they|it|any|all)$/iu;

const OPENERS = '([{「『【〔〖<';
const CLOSERS = ')]}」』】〕〗>';
const EDGE_CHAR = /[\p{P}\p{S}\s]/u;

/** Trims punctuation, symbols and spaces at both ends, keeping balanced brackets. */
function trimEdges(value: string): string {
  const chars = [...value];
  for (;;) {
    const c = chars[chars.length - 1];
    if (c === undefined || !EDGE_CHAR.test(c)) break;
    const opener = OPENERS[CLOSERS.indexOf(c)];
    if (opener !== undefined && chars.slice(0, -1).includes(opener)) break;
    chars.pop();
  }
  for (;;) {
    const c = chars[0];
    if (c === undefined || !EDGE_CHAR.test(c)) break;
    const closer = CLOSERS[OPENERS.indexOf(c)];
    if (closer !== undefined && chars.slice(1).includes(closer)) break;
    chars.shift();
  }
  return chars.join('');
}

function isInfoToken(token: string): boolean {
  if (NOTE_RE.test(token)) return true;
  if (detectDay(token).dayHint) return true;
  if (detectEvents(token).some((e) => !e.generic)) return true;
  // Only confident codes: "B-12", "東ホ12a", "A01"; a lone "K2" may be a name.
  return findBoothCandidates(token, []).some(
    (c) => c.source !== 'alnum' || /-|\d{2}/.test(c.value)
  );
}

const BARE_NUMBER = /^\d+$/;

/**
 * Info flag per token. A bare number is info only after an info token
 * ("서코 45", "Booth 12", "AX 2026") or on its own; in "Team 2" it is part of
 * the name.
 */
function infoFlags(tokens: readonly string[]): boolean[] {
  const flags: boolean[] = [];
  tokens.forEach((token, i) => {
    flags.push(BARE_NUMBER.test(token) ? tokens.length === 1 || flags[i - 1] === true : isInfoToken(token));
  });
  return flags;
}

function namedEvent(text: string) {
  return detectEvents(text).find((e) => !e.generic);
}

function isInfoSegment(segment: string): boolean {
  if (infoFlags(segment.split(/\s+/).filter(Boolean)).some(Boolean)) return true;
  // Multi-word event names: "Anime Expo 2026".
  return namedEvent(segment) !== undefined;
}

/** Trailing "서코 B-12", "C108 1日目", "通販中", "Anime Expo 2026" after a name. */
function dropTrailingInfo(name: string): string {
  let tokens = name.split(/\s+/).filter(Boolean);
  for (;;) {
    const flags = infoFlags(tokens);
    let n = tokens.length;
    while (n > 1 && flags[n - 1]) n--;
    tokens = tokens.slice(0, n);
    // A multi-word event name at the end ("Luna Anime Expo 2026").
    const joined = tokens.join(' ');
    const ev = detectEvents(joined).find((e) => !e.generic && e.index > 0 && e.end === joined.length);
    if (!ev) break;
    tokens = joined.slice(0, ev.index).split(/\s+/).filter(Boolean);
  }
  return tokens.join(' ');
}

function finish(value: string): string | undefined {
  const cleaned = trimEdges(collapseSpaces(trimEdges(stripEmoji(value)).replace(POLITE_END, '')));
  if (!cleaned || cleaned.length > MAX_NAME_LENGTH) return undefined;
  if (!/[\p{L}\p{N}]/u.test(cleaned)) return undefined;
  return cleaned;
}

/** Circle name from an explicit label in the post, if any. */
export function extractLabeledCircle(text: string): string | undefined {
  const quoted = text.match(CIRCLE_QUOTED_RE)?.[1];
  if (quoted) return finish(quoted);
  const raw = text.match(CIRCLE_LABEL_RE)?.[1];
  if (!raw) return undefined;
  const cut = raw.split(VALUE_END)[0] ?? '';
  return finish(dropTrailingInfo(stripEmoji(cut).trim()));
}

export interface AuthorParts {
  /** Display name part (before the first "@"), or the handle when there is no display name. */
  name: string;
  /** Text after "@" when it is event info rather than a handle. */
  tail: string;
  /** `name` is the account handle: usable as a circle name, never as event or booth info. */
  nameIsHandle?: boolean;
}

/** The account handle that ends "Display Name @handle" (see entrypoints/content.ts). */
const TRAILING_HANDLE = /\s@[A-Za-z0-9_]{1,15}$/u;
const HANDLE_SHAPED = /^[A-Za-z0-9_]{1,15}$/u;

/**
 * "달빛서클 @moon" -> name "달빛서클"; "山田@C108 1日目東ホ-12a" -> name
 * "山田", tail "C108 1日目東ホ-12a" (Japanese authors put their space there).
 * The account handle never counts as info: "Mina @AX_mina" has no event.
 */
export function splitAuthor(author: string): AuthorParts {
  const norm = normalizeText(author).trim().replace(TRAILING_HANDLE, '').trim();
  const at = norm.indexOf('@');
  if (at === -1) return { name: norm, tail: '' };
  if (at === 0) {
    const handle = norm.slice(1).split(/\s+/)[0] ?? '';
    return { name: handle, tail: '', nameIsHandle: true };
  }
  const name = norm.slice(0, at);
  let tail = norm.slice(at + 1).trim();
  // "山田@C108" is event info; "Mina@AX_mina" is a handle that merely starts with one.
  if (
    HANDLE_SHAPED.test(tail) &&
    !detectEvents(tail).some((e) => !e.generic && e.index === 0 && e.end === tail.length)
  ) {
    tail = '';
  }
  // "info@handle": drop a trailing handle from the info part.
  tail = tail.replace(/\s*@[A-Za-z0-9_]{1,15}\s*$/, '').trim();
  return { name, tail };
}

/**
 * Circle name from a display name: removes emoji, 🔒, [event] / 【event】
 * tags, "(부스 …)" style notes, "| info" suffixes and trailing booth or event
 * tokens.
 */
export function circleFromAuthorName(name: string): string | undefined {
  let s = stripEmoji(normalizeText(name));
  s = s.replace(TAG_BRACKETS, ' ');
  s = s.replace(PARENS, (m, inner: string) =>
    isInfoSegment(inner) || PRONOUNS.test(inner.trim()) ? ' ' : m
  );
  const segments = s.split(SEPARATORS).map((x) => x.trim()).filter(Boolean);
  const first = segments.find((seg) => !isInfoSegment(seg)) ?? segments[0] ?? '';
  return finish(dropTrailingInfo(first));
}
