import { describe, expect, it } from 'vitest';
import { parseBoothText } from './text';

describe('parseBoothText', () => {
  it('parses bracketed event/booth format', () => {
    const r = parseBoothText('[서코45/A-01] 서클명입니다!');
    expect(r.eventHint).toBe('서코45');
    expect(r.boothNumber).toBe('A-01');
  });

  it('detects mail order', () => {
    expect(parseBoothText('통판 오픈합니다').boothNumber).toBe('통판');
  });

  it('collects unique urls', () => {
    const r = parseBoothText('폼 https://a.com/x 그리고 https://a.com/x https://b.com');
    expect(r.formUrl).toBe('https://a.com/x\nhttps://b.com');
  });

  it('uses author display name as circle name', () => {
    expect(parseBoothText('hi', { author: '달빛서클 @moon' }).circleName).toBe('달빛서클');
  });
});
