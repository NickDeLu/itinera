import { Command } from "./Command";
import { TripRepository } from "../repositories/TripRepository";

export class FetchTripsCommand implements Command {
  constructor(private userId: string) {}

  async execute(): Promise<any> {
    const trips = await TripRepository.getTripsByUserId(this.userId);

    return {
      success: true,
      message: `Fetched ${trips.length} trip(s)`,
      trips: trips,
    };
  }
}
