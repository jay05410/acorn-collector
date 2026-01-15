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

const PRODUCT_KEYWORDS = [
  '아크릴',
  '키링',
  '스탠드',
  '포스터',
  '엽서',
  '스티커',
  '포토카드',
  '포카',
  '메모지',
  '떡메',
  '마스킹테이프',
  '마테',
  '배지',
  '뱃지',
  '책',
  '본',
  '일러북',
  '엽서세트',
  '세트',
  '달력',
  '캘린더',
  '파우치',
  '가방',
  '인형',
  '봉제',
  '쿠션',
];

function parseItemsFromText(
  text: string
): Array<{ name: string; price: number | null }> {
  const items: Array<{ name: string; price: number | null }> = [];
  const lines = text.split(/[\n\r]+/);
  const pricePattern = /(\d{1,3}(?:,\d{3})*|\d+)\s*원/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 2) continue;

    const hasKeyword = PRODUCT_KEYWORDS.some((kw) =>
      trimmed.toLowerCase().includes(kw.toLowerCase())
    );

    if (hasKeyword) {
      const priceMatch = trimmed.match(pricePattern);
      let price: number | null = null;

      if (priceMatch) {
        const priceStr = priceMatch[0].replace(/[,원\s]/g, '');
        price = parseInt(priceStr, 10);
        if (isNaN(price)) price = null;
      }

      const name = trimmed.replace(pricePattern, '').trim();
      if (name.length >= 2) {
        items.push({ name, price });
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
    const priceStr = pricePart.replace(/,/g, '');
    const price = parseInt(priceStr, 10);

    if (name.length >= 2 && !items.some((i) => i.name === name)) {
      items.push({ name, price: isNaN(price) ? null : price });
    }
  }

  return items;
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
      const items = parseItemsFromText(combinedText);

      const uniqueItems = items.filter(
        (item, index, self) =>
          index === self.findIndex((i) => i.name === item.name)
      );

      return new Response(
        JSON.stringify({
          success: true,
          result: {
            items: uniqueItems,
            rawText: combinedText,
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
