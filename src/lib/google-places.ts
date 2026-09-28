const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '';

export interface GooglePlace {
  name: string;
  formatted_address: string;
}

interface PlaceResult {
  displayName: {
    text: string;
    languageCode: string;
  };
  formattedAddress: string;
}

interface TextSearchResponse {
  places?: PlaceResult[];
}

export function hasGooglePlacesApiKey(): boolean {
  return GOOGLE_PLACES_API_KEY.length > 0;
}

/** Text search; `languageCode` (BCP 47) localizes names and addresses. */
export async function searchGooglePlaces(
  query: string,
  languageCode: string
): Promise<GooglePlace[]> {
  if (!query.trim()) {
    return [];
  }

  if (!GOOGLE_PLACES_API_KEY) {
    console.warn('[Google Places] API key not configured');
    return [];
  }

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress',
        },
        body: JSON.stringify({
          textQuery: query,
          languageCode,
          pageSize: 10,
        }),
      }
    );

    if (!response.ok) {
      console.error(`[Google Places] API error ${response.status}`);
      throw new Error(`Google Places API error: ${response.status}`);
    }

    const data: TextSearchResponse = await response.json();

    if (!data.places) {
      return [];
    }

    return data.places.map((place) => ({
      name: place.displayName.text,
      formatted_address: place.formattedAddress,
    }));
  } catch (error) {
    console.error('[Google Places] Search failed:', error);
    throw error;
  }
}
