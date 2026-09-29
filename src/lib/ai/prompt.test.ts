import { describe, expect, it } from 'vitest';
import { APP_LANGUAGES, LANGUAGE_INFO } from '@/i18n/languages';
import { buildSystemPrompt, buildUserContent, systemPromptFor } from './prompt';

describe('buildSystemPrompt', () => {
  it('names the target language and keeps the benchmarked rules', () => {
    const prompt = buildSystemPrompt('Korean');
    expect(prompt).toContain('translated into Korean');
    expect(prompt).toContain('Variants of one product');
    expect(prompt).toContain('"3k" = 3000');
    expect(prompt).toContain('ISO 4217');
  });

  it('resolves app languages to English names', () => {
    expect(systemPromptFor('zh-TW')).toContain('translated into Traditional Chinese');
  });

  it.each(APP_LANGUAGES)('has an English name for %s to translate into', (language) => {
    const { englishName } = LANGUAGE_INFO[language];
    // A plain English name (no native script) that the model can follow.
    expect(englishName).toMatch(/^[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*$/);
    expect(systemPromptFor(language)).toContain(`translated into ${englishName};`);
  });
});

describe('buildUserContent', () => {
  it('marks missing text explicitly', () => {
    expect(buildUserContent('   ')).toBe(
      'Post text:\n(none)\n\nExtract from the text and the attached image(s).'
    );
  });

  it('adds cleaned event and currency hints', () => {
    const content = buildUserContent('  Booth A-01 ', {
      eventNames: ['  Comic  World ', '', 'Comic World', 'Comiket 108'],
      defaultCurrency: 'krw',
    });
    expect(content).toBe(
      [
        'Post text:\nBooth A-01',
        'Known events (if the post is for one of these, use its exact name for booth.event):\n- Comic World\n- Comiket 108',
        'Default currency if the prices show no symbol or unit: KRW',
        'Extract from the text and the attached image(s).',
      ].join('\n\n')
    );
  });

  it('ignores invalid currencies, caps hints and truncates long text', () => {
    const names = Array.from({ length: 40 }, (_, i) => `Event ${i}`);
    const content = buildUserContent('x'.repeat(9000), { eventNames: names, defaultCurrency: '원' });
    expect(content).not.toContain('Default currency');
    expect(content).toContain('- Event 29');
    expect(content).not.toContain('- Event 30');
    expect(content).toContain(`${'x'.repeat(8000)}\n`);
    expect(content).not.toContain('x'.repeat(8001));
  });
});
