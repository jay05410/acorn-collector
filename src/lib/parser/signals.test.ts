import { describe, expect, it } from 'vitest';
import { detectDay } from './signals';

describe('detectDay weekdays', () => {
  it.each([
    ['BW2026 周日 摊位 H-33', 'sun'],
    ['每周三更新', 'wed'],
    ['CWT67 週六', 'sat'],
    ['星期五見', 'fri'],
    ['10/3周六 CP30', 'sat'],
    ['2026.10.3星期六', 'sat'],
  ])('%s -> %s', (text, weekday) => {
    expect(detectDay(text).weekday).toBe(weekday);
  });

  it.each([
    ['一周三次', 'three times a week'],
    ['两周一次', 'once every two weeks'],
    ['兩週一更', 'every two weeks'],
    ['2周一次', 'once every 2 weeks'],
    ['一星期三次', 'three times a week'],
  ])('%s has no weekday (%s)', (text) => {
    const day = detectDay(text);
    expect(day.weekday).toBeUndefined();
    expect(day.dayHint).toBeUndefined();
  });
});
