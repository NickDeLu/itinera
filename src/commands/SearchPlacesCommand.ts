import { Command } from "./Command";
import { GeoapifyService, GeoapifySearchResult } from "../services/GeoapifyService";

export class SearchPlacesCommand implements Command {
  constructor(
    private location: string,
    private categories: string,
    private radius?: number,
    private limit?: number,
    private query?: string,
    private intention?: string
  ) {}

  async execute(): Promise<{
    success: boolean;
    location: { lat: number; lon: number; formatted: string };
    places: any[];
    totalResults: number;
    summary: string;
  }> {
    try {
      const result: GeoapifySearchResult = await GeoapifyService.searchPlaces({
        location: this.location,
        categories: this.categories,
        radius: this.radius,
        limit: this.limit,
        query: this.query,
        intention: this.intention,
      });

      // Build a human-readable summary
      const categoryLabels = this.categories
        .split(",")
        .map((c) => c.trim().split(".").pop() || c)
        .join(", ");

      const summary = result.places.length > 0
        ? `Found ${result.places.length} places near ${result.location.formatted} (${categoryLabels}):\n${result.places
            .map(
              (p, i) =>
                `${i + 1}. **${p.name}** — ${p.formatted}${p.website ? ` | [Website](${p.website})` : ""}${p.contact?.phone ? ` | 📞 ${p.contact.phone}` : ""}`
            )
            .join("\n")}`
        : `No places found near ${result.location.formatted} for categories: ${categoryLabels}. Try broadening your search.`;

      return {
        success: true,
        location: result.location,
        places: result.places,
        totalResults: result.totalResults,
        summary,
      };
    } catch (err: any) {
      return {
        success: false,
        location: { lat: 0, lon: 0, formatted: "" },
        places: [],
        totalResults: 0,
        summary: `Failed to search places: ${err.message}`,
      };
    }
  }
}