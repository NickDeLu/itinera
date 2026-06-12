import { Command } from "./Command";
import { TripRepository } from "../repositories/TripRepository";

export class EditTripCommand implements Command {
  constructor(
    private tripId: string,
    private updates: {
      name?: string;
      destination?: string;
      start_date?: string;
      end_date?: string;
      description?: string;
      status?: string;
    }
  ) {}

  async execute(): Promise<any> {
    // Verify trip exists
    const trip = await TripRepository.getTripById(this.tripId);
    if (!trip) {
      throw new Error(`Trip with id ${this.tripId} not found`);
    }

    const updatedTrip = await TripRepository.updateTrip(this.tripId, this.updates);

    return {
      success: true,
      message: `Trip '${updatedTrip.name}' updated successfully`,
      id: updatedTrip.id,
      trip: updatedTrip,
    };
  }
}
