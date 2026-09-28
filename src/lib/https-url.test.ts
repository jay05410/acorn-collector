import { describe, expect, it } from 'vitest';
import { HttpsUrlError, parseHttpsUrl } from './https-url';

describe('parseHttpsUrl', () => {
  it('returns the parsed URL', () => {
    expect(parseHttpsUrl('https://a.example/x?q=1#h').href).toBe(
      'https://a.example/x?q=1#h'
    );
  });

  it.each([
    ['not a URL', 'not a url'],
    ['not a URL', '/relative'],
    ['must use https', 'http://a.example/'],
    ['must use https', 'javascript:alert(1)'],
    ['must use https', 'data:text/html,x'],
    ['must not contain credentials', 'https://user@a.example/'],
    ['must not contain credentials', 'https://user:pw@a.example/'],
  ])('rejects with "%s": %s', (reason, value) => {
    expect(() => parseHttpsUrl(value)).toThrow(new HttpsUrlError(reason));
  });
});
