import { Command } from "./Command";
import { TripRepository } from "../repositories/TripRepository";

export class CreateTripCommand implements Command {
  constructor(
    private userId: string,
    private name: string,
    private destination?: string,
    private startDate?: string,
    private endDate?: string,
    private description?: string
  ) {}

  async execute(): Promise<any> {
    const trip = await TripRepository.createTrip(
      this.userId,
      this.name,
      this.destination,
      this.startDate,
      this.endDate,
      this.description
    );

    return {
      success: true,
      message: `Trip '${this.name}' created successfully`,
      id: trip.id,
      trip: trip,
    };
  }
}
