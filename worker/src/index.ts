interface Env {
  AZURE_ENDPOINT: string;
  AZURE_API_KEY: string;
}

interface ReadResult {
  status: 'notStarted' | 'running' | 'succeeded' | 'failed';
  analyzeResult?: {
    readResults: Array<{
      lines: Array<{
        text: string;
      }>;
    }>;
  };
}

// 상품 키워드 (카테고리별 분류)
const PRODUCT_KEYWORDS_BY_CATEGORY: Record<string, string[]> = {
  아크릴: ['아크릴', '아크스탠드', '아크키링', '아키', '쉐이커'],
  키링: ['키링', '참'],
  스탠드: ['스탠드', '스탠디'],
  포스터: ['포스터', '타페스트리', '족자'],
  엽서: ['엽서', '엽서세트', '일러카드'],
  스티커: ['스티커', '칼선스티커', '씰스티커', '다꾸'],
  포토카드: ['포토카드', '포카', '트레카', '셀카'],
  메모지: ['메모지', '떡메', '메모패드'],
  테이프: ['마스킹테이프', '마테', '테이프'],
  배지: ['배지', '뱃지', '틴배지', '캔배지'],
  책: ['책', '본', '일러북', '화보집', '아트북', '합본'],
  달력: ['달력', '캘린더'],
  파우치: ['파우치', '가방', '토트백', '에코백'],
  인형: ['인형', '봉제', '쿠션', '인형옷', '키키팽'],
  의류: ['티셔츠', '후드', '옷'],
  기타: ['세트', '랜덤박스', '럭키박스', '굿즈'],
};

// 평탄화된 키워드 목록 (검색용)
const PRODUCT_KEYWORDS = Object.values(PRODUCT_KEYWORDS_BY_CATEGORY).flat();

// 제외 키워드 (상품이 아닌 것들)
const EXCLUDE_KEYWORDS = [
  '배송',
  '배송비',
  '택배',
  '할인',
  '이벤트',
  '안내',
  '문의',
  '예약',
  '입금',
  '계좌',
  '공지',
  '리트윗',
  'RT',
  '@',
  'http',
  'www',
  '작가',
  '그림',
  '입니다',
  '합니다',
  '드립니다',
  '감사',
  '부스',
  '번호',
  '위치',
];

// 가격 유효 범위 (동인굿즈 일반 가격대)
const MIN_VALID_PRICE = 500;
const MAX_VALID_PRICE = 200000;

interface ParsedItem {
  name: string;
  price: number | null;
  category: string | null;
  confidence: number;
}

interface ParseResult {
  items: ParsedItem[];
  overallConfidence: number;
}

function detectCategory(text: string): string | null {
  const lowerText = text.toLowerCase();
  for (const [category, keywords] of Object.entries(
    PRODUCT_KEYWORDS_BY_CATEGORY
  )) {
    if (keywords.some((kw) => lowerText.includes(kw.toLowerCase()))) {
      return category;
    }
  }
  return null;
}

function hasExcludeKeyword(text: string): boolean {
  const lowerText = text.toLowerCase();
  return EXCLUDE_KEYWORDS.some((kw) => lowerText.includes(kw.toLowerCase()));
}

function isValidPrice(price: number): boolean {
  return price >= MIN_VALID_PRICE && price <= MAX_VALID_PRICE;
}

function calculateItemConfidence(item: {
  name: string;
  price: number | null;
  category: string | null;
}): number {
  let score = 0;

  if (item.category) score += 50;
  if (item.price !== null && isValidPrice(item.price)) score += 20;
  if (item.name.length >= 3 && item.name.length <= 30) score += 20;
  if (!hasExcludeKeyword(item.name)) score += 10;

  return score;
}

function parseItemsFromText(text: string): ParseResult {
  const items: ParsedItem[] = [];
  const lines = text.split(/[\n\r]+/);
  const pricePattern = /(\d{1,3}(?:,\d{3})*|\d+)\s*원/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2) continue;
    if (hasExcludeKeyword(trimmed)) continue;

    const category = detectCategory(trimmed);
    const hasKeyword = category !== null;

    if (hasKeyword) {
      const priceMatch = trimmed.match(pricePattern);
      let price: number | null = null;

      if (priceMatch) {
        const priceStr = priceMatch[0].replace(/[,원\s]/g, '');
        price = parseInt(priceStr, 10);
        if (isNaN(price) || !isValidPrice(price)) price = null;
      }

      const name = trimmed.replace(pricePattern, '').trim();
      if (name.length >= 2) {
        const item = { name, price, category };
        items.push({ ...item, confidence: calculateItemConfidence(item) });
      }
    }
  }

  const priceOnlyMatches = text.matchAll(
    /(.{2,20}?)\s*(\d{1,3}(?:,\d{3})*|\d+)\s*원/g
  );
  for (const match of priceOnlyMatches) {
    const namePart = match[1];
    const pricePart = match[2];
    if (!namePart || !pricePart) continue;

    const name = namePart.trim();
    if (hasExcludeKeyword(name)) continue;

    const priceStr = pricePart.replace(/,/g, '');
    const price = parseInt(priceStr, 10);

    if (!isValidPrice(price)) continue;

    const category = detectCategory(name);

    if (name.length >= 2 && !items.some((i) => i.name === name)) {
      const item = { name, price: isNaN(price) ? null : price, category };
      items.push({ ...item, confidence: calculateItemConfidence(item) });
    }
  }

  const validItems = items.filter((item) => item.confidence >= 30);
  const overallConfidence =
    validItems.length > 0
      ? Math.round(
          validItems.reduce((sum, item) => sum + item.confidence, 0) /
            validItems.length
        )
      : 0;

  return { items: validItems, overallConfidence };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function analyzeImage(imageUrl: string, env: Env): Promise<string> {
  const analyzeUrl = `${env.AZURE_ENDPOINT}/vision/v3.2/read/analyze`;

  const analyzeResponse = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': env.AZURE_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: imageUrl }),
  });

  if (!analyzeResponse.ok) {
    const errorText = await analyzeResponse.text();
    throw new Error(
      `Azure analyze failed: ${analyzeResponse.status} - ${errorText}`
    );
  }

  const operationLocation = analyzeResponse.headers.get('Operation-Location');
  if (!operationLocation) {
    throw new Error('No Operation-Location header');
  }

  let attempts = 0;
  const maxAttempts = 30;

  while (attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 1000));

    const resultResponse = await fetch(operationLocation, {
      headers: {
        'Ocp-Apim-Subscription-Key': env.AZURE_API_KEY,
      },
    });

    if (!resultResponse.ok) {
      throw new Error(`Azure result fetch failed: ${resultResponse.status}`);
    }

    const result: ReadResult = await resultResponse.json();

    if (result.status === 'succeeded') {
      const lines =
        result.analyzeResult?.readResults?.flatMap((r) =>
          r.lines.map((l) => l.text)
        ) || [];
      return lines.join('\n');
    }

    if (result.status === 'failed') {
      throw new Error('Azure OCR failed');
    }

    attempts++;
  }

  throw new Error('Azure OCR timeout');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', {
        status: 405,
        headers: corsHeaders,
      });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/ocr') {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    try {
      const body = (await request.json()) as { imageUrls: string[] };
      const { imageUrls } = body;

      if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        return new Response(JSON.stringify({ error: 'imageUrls required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const allText: string[] = [];
      const maxImages = Math.min(imageUrls.length, 4);

      for (let i = 0; i < maxImages; i++) {
        try {
          const text = await analyzeImage(imageUrls[i], env);
          allText.push(text);
        } catch (err) {
          console.error(`Image ${i} failed:`, err);
        }
      }

      const combinedText = allText.join('\n---\n');
      const parseResult = parseItemsFromText(combinedText);

      const uniqueItems = parseResult.items.filter(
        (item, index, self) =>
          index === self.findIndex((i: ParsedItem) => i.name === item.name)
      );

      return new Response(
        JSON.stringify({
          success: true,
          result: {
            items: uniqueItems,
            rawText: combinedText,
            overallConfidence: parseResult.overallConfidence,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
