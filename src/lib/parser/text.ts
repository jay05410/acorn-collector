import type { ParsedBooth } from '@/types';

const EVENT_KEYWORDS = {
  ko: [
    '서코',
    '코믹월드',
    '서울코믹월드',
    '디페스타',
    '동네페스타',
    '디페',
    '일러스타',
    '아이소',
    '부스데이즈',
    '온리전',
    '팬미팅',
  ],
  en: [
    'Comiket',
    'Comic Market',
    'Anime Expo',
    'AX',
    'Anime NYC',
    'Otakon',
    'Fanime',
    'Anime Central',
    'Artist Alley',
    'Fan Expo',
    'Comic Con',
    'SDCC',
    'NYCC',
    'Anime Boston',
    'Katsucon',
    'AWA',
  ],
  ja: [
    'コミケ',
    'コミックマーケット',
    'コミティア',
    'COMITIA',
    'コミトレ',
    'コミックトレジャー',
    'サンクリ',
    'サンシャインクリエイション',
    'スパコミ',
    'SUPER COMIC CITY',
    'コミックシティ',
    'COMIC CITY',
    'ワンフェス',
    'ワンダーフェスティバル',
    'C\\d+',
  ],
  zh: [
    'CP',
    'BW',
    'ComiCon',
    '漫展',
    '同人展',
    '国漫',
    'ChinaJoy',
    'CJ',
    'CICF',
    'COMICUP',
    '魔都同人祭',
    'SHCC',
    'BJCC',
  ],
};

const ZONE_KEYWORDS = {
  ko: [
    '쁘띠존',
    '프리존',
    '신간존',
    '합동존',
    '기업존',
    '동인존',
    '일반존',
    '특별존',
  ],
  en: [
    'Artist Alley',
    'Dealer',
    'Small Press',
    'Corporate',
    'Indie',
    'Fan Table',
  ],
  ja: [
    '企業ブース',
    '同人ブース',
    'サークルスペース',
    '壁サークル',
    '島中',
    'お誕生日席',
  ],
  zh: ['同人区', '企业区', '画师区', '独立区'],
};

const BOOTH_SUFFIXES = {
  ko: ['부스', '번'],
  en: ['booth', 'table'],
  ja: ['ブース', '番', 'スペース'],
  zh: ['摊位', '号'],
};

function buildEventRegex(): RegExp {
  const allKeywords = Object.values(EVENT_KEYWORDS).flat();
  return new RegExp(`(${allKeywords.join('|')})\\d*`, 'i');
}

function buildZoneRegex(): RegExp {
  const allKeywords = Object.values(ZONE_KEYWORDS).flat();
  return new RegExp(`(${allKeywords.join('|')})`, 'i');
}

function buildBoothSuffixPattern(): string {
  const allSuffixes = Object.values(BOOTH_SUFFIXES).flat();
  return `(?:${allSuffixes.join('|')})?`;
}

interface ParseOptions {
  author?: string;
}

export function parseBoothText(
  text: string,
  options?: ParseOptions
): ParsedBooth {
  const result: ParsedBooth = {
    confidence: 0,
  };

  let confidence = 0;

  const bracketMatch = text.match(/\[([^\]/]+)\/([A-Z]-?\d+)\]/i);
  if (bracketMatch && bracketMatch[1] && bracketMatch[2]) {
    result.eventHint = bracketMatch[1].trim();
    result.boothNumber = bracketMatch[2].toUpperCase();
    confidence += 0.5;
  } else {
    const boothPattern = new RegExp(
      `\\b([A-Z]-?\\d{1,3})${buildBoothSuffixPattern()}\\b`,
      'i'
    );
    const boothMatch = text.match(boothPattern);
    if (boothMatch && boothMatch[1]) {
      result.boothNumber = boothMatch[1].toUpperCase();
      confidence += 0.3;
    }
  }

  if (!result.eventHint) {
    const eventRegex = buildEventRegex();
    const eventMatch = text.match(eventRegex);
    if (eventMatch) {
      result.eventHint = eventMatch[1];
      confidence += 0.1;
    }
  }

  const zoneRegex = buildZoneRegex();
  const zoneMatch = text.match(zoneRegex);
  if (zoneMatch) {
    result.zone = zoneMatch[1];
    confidence += 0.1;
  }

  // Parse ALL URLs from text
  const urlPattern = /https?:\/\/[^\s)>\]"<]+/gi;
  const urlMatches = text.match(urlPattern);
  if (urlMatches && urlMatches.length > 0) {
    // Store unique URLs joined by newline for multiple URL support
    const uniqueUrls = [...new Set(urlMatches)];
    result.formUrl = uniqueUrls.join('\n');
    confidence += 0.1;
  }

  if (options?.author) {
    const authorName = extractDisplayName(options.author);
    if (authorName && authorName.length > 0 && authorName.length < 50) {
      result.circleName = authorName;
      confidence += 0.3;
    }
  }

  result.confidence = Math.min(confidence, 1);
  return result;
}

function extractDisplayName(author: string): string {
  const trimmed = author.trim();
  const atIndex = trimmed.lastIndexOf('@');

  if (atIndex > 0) {
    return trimmed.slice(0, atIndex).trim();
  }

  if (trimmed.startsWith('@')) {
    return trimmed.slice(1);
  }

  return trimmed;
}

export function isValidBoothNumber(boothNumber: string): boolean {
  return /^[A-Z]\d*-?\d+$/i.test(boothNumber);
}
