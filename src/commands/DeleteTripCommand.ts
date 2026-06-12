import { Command } from "./Command";
import { TripRepository } from "../repositories/TripRepository";

export class DeleteTripCommand implements Command {
  constructor(private tripId: string) {}

  async execute(): Promise<any> {
    // Verify trip exists
    const trip = await TripRepository.getTripById(this.tripId);
    if (!trip) {
      throw new Error(`Trip with id ${this.tripId} not found`);
    }

    await TripRepository.deleteTrip(this.tripId);

    return {
      success: true,
      message: `Trip '${trip.name}' deleted successfully`,
      id: this.tripId,
    };
  }
}
