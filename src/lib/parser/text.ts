import type { ParsedBooth } from '@/types';

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

  // 부스번호 파싱: [이벤트/A-01], A-01, A01, C18부스 등
  const bracketMatch = text.match(/\[([^\]/]+)\/([A-Z]-?\d+)\]/i);
  if (bracketMatch && bracketMatch[1] && bracketMatch[2]) {
    result.eventHint = bracketMatch[1].trim();
    result.boothNumber = bracketMatch[2].toUpperCase();
    confidence += 0.5;
  } else {
    // "C18부스", "A-01", "A01" 등
    const boothMatch = text.match(/\b([A-Z]-?\d{1,3})(?:부스|번)?\b/i);
    if (boothMatch && boothMatch[1]) {
      result.boothNumber = boothMatch[1].toUpperCase();
      confidence += 0.3;
    }
  }

  if (!result.eventHint) {
    const eventMatch = text.match(
      /(서코\d*|코믹월드\d*|서울코믹월드|디페스타|동네페스타|디페\d*|일러스타\d*|아이소|부스데이즈|온리전|팬미팅)/i
    );
    if (eventMatch) {
      result.eventHint = eventMatch[1];
      confidence += 0.1;
    }
  }

  const zoneMatch = text.match(
    /(쁘띠존|프리존|신간존|합동존|기업존|동인존|일반존|특별존)/i
  );
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
