import axios from "axios";

export interface GeoapifyPlace {
  name: string;
  formatted: string;
  address_line1: string;
  address_line2: string;
  lat: number;
  lon: number;
  categories: string[];
  website?: string;
  contact?: {
    phone?: string;
    email?: string;
  };
  opening_hours?: {
    open_now?: boolean;
    weekly_text?: string[];
  };
  place_id: string;
  datasource?: any;
  [key: string]: any;
}

export interface GeoapifySearchParams {
  /** City name or location string e.g. "Toronto" or "Paris, France" or "Times Square, New York" */
  location: string;
  /** Geoapify category hierarchy, comma-separated. Examples:
   *  - "catering.restaurant" for restaurants
   *  - "catering.restaurant, catering.cafe" for restaurants and cafes
   *  - "tourism.sights" for tourist attractions
   *  - "tourism.sights, tourism.attraction" for sights & attractions
   *  - "entertainment" for entertainment venues
   *  - "leisure" for leisure activities (parks, sports)
   *  - "catering.restaurant.japanese" for Japanese restaurants specifically
   *  - "commercial.supermarket" for grocery/supermarket
   *  - "accommodation.hotel" for hotels
   *  - "entertainment.museum" for museums
   *  - "catering.bar, catering.pub" for nightlife
   *  Can also pass "all" to search broadly across all categories.
   */
  categories: string;
  /** Search radius in meters from the location center (default: 5000 = 5km) */
  radius?: number;
  /** Maximum number of results to return (default: 10, max: 50) */
  limit?: number;
  /** Optional free-text query to filter results by name/keyword */
  query?: string;
  /** The user's intention context (e.g. "find dinner spots", "morning activities") */
  intention?: string;
}

export interface GeoapifySearchResult {
  location: {
    lat: number;
    lon: number;
    formatted: string;
  };
  places: GeoapifyPlace[];
  totalResults: number;
}

export class GeoapifyService {
  private static apiKey: string = process.env.GEOAPIFY_API_KEY || "";

  static getApiKey(): string {
    return this.apiKey;
  }

  /**
   * Geocode a location string to get coordinates
   */
  static async geocodeLocation(location: string): Promise<{ lat: number; lon: number; formatted: string }> {
    const response = await axios.get("https://api.geoapify.com/v1/geocode/search", {
      params: {
        text: location,
        format: "json",
        apiKey: this.apiKey,
        limit: 1,
      },
    });

    if (!response.data?.results?.length) {
      throw new Error(`Could not geocode location: "${location}". No results found.`);
    }

    const result = response.data.results[0];
    return {
      lat: result.lat,
      lon: result.lon,
      formatted: result.formatted || `${result.city || location}, ${result.country || ""}`,
    };
  }

  /**
   * Search for places using the Geoapify Places API v2
   */
  static async searchPlaces(params: GeoapifySearchParams): Promise<GeoapifySearchResult> {
    if (!this.apiKey) {
      throw new Error("GEOAPIFY_API_KEY is not configured in environment variables");
    }

    // 1. Geocode the location to get coordinates
    const geoResult = await this.geocodeLocation(params.location);

    const radius = params.radius || 5000;
    const limit = Math.min(params.limit || 20, 50);

    // 2. Build the filter (circle around the geocoded location)
    const filter = `circle:${geoResult.lon},${geoResult.lat},${radius}`;

    // 3. Build the categories parameter
    const categories = params.categories === "all"
      ? "building,commercial,entertainment,catering,tourism,leisure,accommodation,service,activity"
      : params.categories;

    // 4. Build the API request
    const requestParams: Record<string, any> = {
      categories: categories,
      filter: filter,
      limit: limit,
      apiKey: this.apiKey,
    };

    // Add bias toward the location for better ranking
    requestParams.bias = `proximity:${geoResult.lon},${geoResult.lat}`;

    // Add optional free-text query if provided
    if (params.query) {
      requestParams.text = params.query;
    }

    console.log(`\n🔍 Geoapify Places Search:`);
    console.log(`   Location: "${params.location}" → ${geoResult.formatted} (${geoResult.lat}, ${geoResult.lon})`);
    console.log(`   Categories: ${categories}`);
    console.log(`   Radius: ${radius}m`);
    console.log(`   Limit: ${limit}`);
    if (params.intention) console.log(`   Intention: ${params.intention}`);
    if (params.query) console.log(`   Query: ${params.query}`);

    const response = await axios.get("https://api.geoapify.com/v2/places", {
      params: requestParams,
      timeout: 15000,
    });

    if (!response.data?.features) {
      return {
        location: geoResult,
        places: [],
        totalResults: 0,
      };
    }

    // 5. Parse and clean the response
    const places: GeoapifyPlace[] = response.data.features
      .filter((f: any) => f.properties?.name) // Only include places with names
      .map((f: any) => ({
        name: f.properties.name,
        formatted: f.properties.formatted,
        address_line1: f.properties.address_line1,
        address_line2: f.properties.address_line2,
        lat: f.properties.lat,
        lon: f.properties.lon,
        categories: f.properties.categories || [],
        website: f.properties.website,
        contact: f.properties.contact,
        opening_hours: f.properties.opening_hours,
        place_id: f.properties.place_id,
        datasource: f.properties.datasource,
        // Include any extra details
        ...(f.properties.catering && { catering: f.properties.catering }),
        ...(f.properties.tourism && { tourism: f.properties.tourism }),
        ...(f.properties.entertainment && { entertainment: f.properties.entertainment }),
        ...(f.properties.leisure && { leisure: f.properties.leisure }),
        ...(f.properties.facilities && { facilities: f.properties.facilities }),
        ...(f.properties.historic && { historic: f.properties.historic }),
      }));

    return {
      location: geoResult,
      places,
      totalResults: places.length,
    };
  }

  /**
   * Quick search - convenience method combining geocoding + places in one call
   */
  static async quickSearch(
    location: string,
    intention: string,
    options?: {
      radius?: number;
      limit?: number;
      categories?: string;
      query?: string;
    }
  ): Promise<GeoapifySearchResult> {
    // Map common intentions to recommended categories
    const categoryMap: Record<string, string> = {
      "restaurants": "catering.restaurant",
      "food": "catering.restaurant,catering.cafe,catering.fast_food",
      "breakfast": "catering.cafe,catering.restaurant.breakfast",
      "coffee": "catering.cafe.coffee_shop,catering.cafe",
      "dinner": "catering.restaurant,catering.bar",
      "nightlife": "catering.bar,catering.pub,entertainment.nightclub",
      "drinks": "catering.bar,catering.pub",
      "attractions": "tourism.sights,tourism.attraction",
      "museums": "entertainment.museum,tourism.sights",
      "shopping": "commercial",
      "hotels": "accommodation.hotel",
      "parks": "leisure.park,leisure.garden",
      "sports": "leisure.sports_centre,leisure.fitness",
      "activities": "tourism.sights,entertainment,leisure",
      "culture": "entertainment.museum,entertainment.theatre,tourism.sights",
      "supermarket": "commercial.supermarket",
      "transport": "transport",
    };

    const intentionLower = intention.toLowerCase().trim();
    let categories = options?.categories;
    
    if (!categories) {
      // Try to match intention to a category
      for (const [key, cat] of Object.entries(categoryMap)) {
        if (intentionLower.includes(key)) {
          categories = cat;
          break;
        }
      }
      // Default to broad search if no match
      if (!categories) {
        categories = "catering.restaurant,catering.cafe,tourism.sights,tourism.attraction,entertainment,leisure";
      }
    }

    return this.searchPlaces({
      location,
      categories,
      radius: options?.radius,
      limit: options?.limit,
      query: options?.query,
      intention,
    });
  }
}