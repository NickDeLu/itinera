import { Command } from "./Command";
import { ItineraryRepository } from "../repositories/ItineraryRepository";
import { TripRepository } from "../repositories/TripRepository";

export class FetchItineraryItemsCommand implements Command {
  constructor(private tripId: string) {}

  async execute(): Promise<any> {
    // Verify trip exists
    const trip = await TripRepository.getTripById(this.tripId);
    if (!trip) {
      throw new Error(`Trip with id ${this.tripId} not found`);
    }

    const items = await ItineraryRepository.getItineraryItemsByTripId(this.tripId);

    return {
      success: true,
      message: `Fetched ${items.length} itinerary item(s)`,
      trip_id: this.tripId,
      trip_name: trip.name,
      items: items,
    };
  }
}