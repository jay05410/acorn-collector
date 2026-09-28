import { describe, expect, it } from 'vitest';
import { EVENT_MATCH_THRESHOLD, detectEvents, matchEvent, type EventRef } from './events';
import { normalizeText } from './normalize';

const ev = (id: string, name: string): EventRef => ({ id, name });

describe('detectEvents', () => {
  it.each([
    ['서울코믹월드 2026 가을', 'seoul-comic-world', '서울코믹월드 2026', 2026],
    ['서코 45회 참가', 'seoul-comic-world', '서코 45회', 45],
    ['C108 1日目', 'comiket', 'C108', 108],
    ['コミックマーケット108', 'comiket', 'コミックマーケット108', 108],
    ['コミティア150', 'comitia', 'コミティア150', 150],
    ['CP30 见', 'comicup', 'CP30', 30],
    ['#CWT67', 'cwt', 'CWT67', 67],
    ['FF42 攤位', 'fancy-frontier', 'FF42', 42],
    ['開拓動漫祭', 'fancy-frontier', '開拓動漫祭', undefined],
    ['Anime Expo 2026', 'anime-expo', 'Anime Expo 2026', 2026],
    ['AX 2026', 'anime-expo', 'AX 2026', 2026],
    ['Comic Frontier', 'comic-frontier', 'Comic Frontier', undefined],
    ['CF21', 'comic-frontier', 'CF21', 21],
    ['Japan Expo', 'japan-expo', 'Japan Expo', undefined],
    ['ワンフェス2026冬', 'wonder-festival', 'ワンフェス2026', 2026],
  ])('%s -> %s', (text, id, hint, number) => {
    const found = detectEvents(normalizeText(text));
    expect(found[0]?.id).toBe(id);
    expect(found[0]?.hint).toBe(hint);
    expect(found[0]?.number).toBe(number);
  });

  it.each([
    ['FF14 本', 'Final Fantasy XIV'],
    ['五悠 CP 本', 'pairing tag'],
    ['BW 스케치', 'black and white'],
    ['서코 10/17', 'date after the name is not an edition'],
    ['C12 부스', 'booth-shaped C code in a Korean post'],
  ])('%s is not a numbered event (%s)', (text) => {
    const found = detectEvents(normalizeText(text));
    expect(found.every((e) => e.number === undefined)).toBe(true);
    expect(found.some((e) => ['fancy-frontier', 'comicup', 'bilibili-world', 'comiket'].includes(e.id))).toBe(
      false
    );
  });

  it('keeps the longest of overlapping aliases', () => {
    const found = detectEvents('서울코믹월드');
    expect(found).toHaveLength(1);
    expect(found[0]?.id).toBe('seoul-comic-world');
  });
});

describe('matchEvent', () => {
  const autumn = ev('e-seoul', '서울코믹월드 2026 가을');
  const busan = ev('e-busan', '부산코믹월드 2026');
  const c107 = ev('e-c107', 'コミックマーケット107');
  const c108 = ev('e-c108', 'コミックマーケット108');

  it.each([
    ['서코', [busan, autumn], 'e-seoul'],
    ['서울 코믹월드', [busan, autumn], 'e-seoul'],
    ['서코45', [autumn], 'e-seoul'], // edition vs year is not a conflict
    ['C108', [c107, c108], 'e-c108'],
    ['コミケ', [ev('x', 'C108 (Comic Market 108)')], 'x'],
    ['AX', [ev('ax', 'Anime Expo 2026')], 'ax'],
    ['AX 2026', [ev('ax5', 'Anime Expo 2025'), ev('ax6', 'Anime Expo 2026')], 'ax6'],
    ['CWT67', [ev('cwt', 'Comic World Taiwan 67')], 'cwt'],
    ['FF42', [ev('ff', '開拓動漫祭 FF42')], 'ff'],
    ['冬コミ', [ev('s', '夏コミ 2026'), ev('w', '冬コミ 2026')], 'w'],
    ['주술 온리전', [ev('h', '하이큐 온리전'), ev('j', '주술회전 온리전 2026')], 'j'],
    ['Otakon 2026', [ev('o', 'otakon 2026')], 'o'],
    ['ｃ１０８', [c108], 'e-c108'],
  ])('%s -> %s', (hint, events, id) => {
    const m = matchEvent(hint, events);
    expect(m?.event.id).toBe(id);
    expect(m?.score).toBeGreaterThanOrEqual(EVENT_MATCH_THRESHOLD);
  });

  it.each([
    ['C107', [c108], 'different edition'],
    ['서코45', [ev('s44', '서코 44회')], 'different edition'],
    ['AX2025', [ev('ax', 'Anime Expo 2026')], 'different year'],
    ['冬コミ', [ev('s', '夏コミ 2026')], 'different season'],
    ['서코', [busan], 'different city'],
    ['서울 코믹월드', [busan], 'only the nested "코믹월드" alias is shared'],
    ['漫展', [ev('sh', '上海漫展 2026')], 'generic word only'],
    ['주술 온리전', [ev('h', '하이큐 온리전')], 'same kind of event, other fandom'],
    ['Otakon', [ev('n', 'Anime NYC 2026')], 'unrelated'],
    ['', [autumn], 'empty hint'],
    ['서코', [], 'no events'],
  ])('%s does not match (%s)', (hint, events) => {
    expect(matchEvent(hint, events)).toBeNull();
  });

  it('pins the threshold between a near miss and an alias match', () => {
    // alias match without an edition number scores 0.75, an edition conflict 0.3
    expect(matchEvent('서코', [autumn])?.score).toBe(0.75);
    expect(matchEvent('C107', [c108], { threshold: 0 })?.score).toBe(0.3);
    expect(matchEvent('서코', [autumn], { threshold: 0.8 })).toBeNull();
    expect(matchEvent('C108', [c108])?.score).toBe(1);
  });

  it('compares raw scores, rounding only the returned score', () => {
    // raw 0.7875 (rounds up to 0.79) vs raw 0.7893 (rounds to 0.79): the higher raw score wins
    const m = matchEvent('moonlight', [ev('a', 'moonlighz'), ev('b', 'moonlightzqxjk')]);
    expect(m?.event.id).toBe('b');
    expect(m?.score).toBe(0.79);
  });

  it('keeps the first event on a tie and returns the caller object', () => {
    const a = { id: 'a', name: '서울코믹월드 봄', extra: 1 };
    const b = { id: 'b', name: '서울코믹월드 가을', extra: 2 };
    const m = matchEvent('서코', [a, b]);
    expect(m?.event).toBe(a);
  });
});
