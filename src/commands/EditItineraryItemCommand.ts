import { Command } from "./Command";
import { ItineraryRepository } from "../repositories/ItineraryRepository";

export class EditItineraryItemCommand implements Command {
  constructor(
    private itemId: string,
    private updates: {
      title?: string;
      description?: string;
      location?: string;
      startTimestamp?: string;
      endTimestamp?: string;
      ordinal?: number;
      status?: string;
      metadata?: Record<string, any>;
    }
  ) {}

  async execute(): Promise<any> {
    // Verify item exists
    const item = await ItineraryRepository.getItineraryItemById(this.itemId);
    if (!item) {
      throw new Error(`Itinerary item with id ${this.itemId} not found`);
    }

    const updatedItem = await ItineraryRepository.updateItineraryItem(
      this.itemId,
      this.updates
    );

    return {
      success: true,
      message: `Itinerary item '${updatedItem.title}' updated successfully`,
      id: updatedItem.id,
      item: updatedItem,
    };
  }
}
