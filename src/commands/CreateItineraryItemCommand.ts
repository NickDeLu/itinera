import { Command } from "./Command";
import { ItineraryRepository } from "../repositories/ItineraryRepository";
import { TripRepository } from "../repositories/TripRepository";

export class CreateItineraryItemCommand implements Command {
  constructor(
    private tripId: string,
    private activityType: string, // slug like "flight", "hotel", etc.
    private title: string,
    private description?: string,
    private location?: string,
    private startTimestamp?: string,
    private endTimestamp?: string,
    private ordinal: number = 0,
    private sourceEmailId?: string,
    private metadata?: Record<string, any>
  ) {}

  async execute(): Promise<any> {
    // Verify trip exists
    const trip = await TripRepository.getTripById(this.tripId);
    if (!trip) {
      throw new Error(`Trip with id ${this.tripId} not found`);
    }

    // Get activity type by slug
    const activityTypeRecord = await ItineraryRepository.getActivityTypeBySlug(
      this.activityType
    );
    if (!activityTypeRecord) {
      throw new Error(`Activity type '${this.activityType}' not found`);
    }

    const itineraryItem = await ItineraryRepository.createItineraryItem(
      this.tripId,
      activityTypeRecord.id,
      this.title,
      this.description,
      this.location,
      this.startTimestamp,
      this.endTimestamp,
      this.ordinal,
      this.sourceEmailId,
      this.metadata
    );

    return {
      success: true,
      message: `Itinerary item '${this.title}' created successfully`,
      id: itineraryItem.id,
      item: itineraryItem,
    };
  }
}
