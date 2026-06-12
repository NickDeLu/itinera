import { Command } from "./Command";
import { ItineraryRepository } from "../repositories/ItineraryRepository";

export class DeleteItineraryItemCommand implements Command {
  constructor(private itemId: string) {}

  async execute(): Promise<any> {
    // Verify item exists
    const item = await ItineraryRepository.getItineraryItemById(this.itemId);
    if (!item) {
      throw new Error(`Itinerary item with id ${this.itemId} not found`);
    }

    await ItineraryRepository.deleteItineraryItem(this.itemId);

    return {
      success: true,
      message: `Itinerary item deleted successfully`,
      id: this.itemId,
    };
  }
}
