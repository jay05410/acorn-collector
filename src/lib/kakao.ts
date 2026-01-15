const KAKAO_API_KEY = import.meta.env.VITE_KAKAO_API_KEY || '';

export interface KakaoPlace {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string;
  y: string;
}

interface KakaoSearchResponse {
  documents: KakaoPlace[];
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
}

export function hasKakaoApiKey(): boolean {
  return KAKAO_API_KEY.length > 0;
}

export async function searchPlaces(query: string): Promise<KakaoPlace[]> {
  if (!query.trim()) {
    return [];
  }

  if (!KAKAO_API_KEY) {
    console.warn('[Kakao] API key not configured');
    return [];
  }

  const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
  url.searchParams.set('query', query);
  url.searchParams.set('size', '10');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `KakaoAK ${KAKAO_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[Kakao] API error ${response.status}:`, errorText);
      throw new Error(`Kakao API error: ${response.status}`);
    }

    const data: KakaoSearchResponse = await response.json();
    return data.documents;
  } catch (error) {
    console.error('[Kakao] Search failed:', error);
    throw error;
  }
}
