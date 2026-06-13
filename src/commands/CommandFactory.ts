import { Command } from "./Command";
import { SaveEmailDataCommand } from "./SaveEmailDataCommand";
import { CreateItineraryItemCommand } from "./CreateItineraryItemCommand";
import { EditItineraryItemCommand } from "./EditItineraryItemCommand";
import { CreateTripCommand } from "./CreateTripCommand";
import { FetchTripsCommand } from "./FetchTripsCommand";
import { FetchItineraryItemsCommand } from "./FetchItineraryItemsCommand";
import { EditTripCommand } from "./EditTripCommand";
import { DeleteItineraryItemCommand } from "./DeleteItineraryItemCommand";
import { DeleteTripCommand } from "./DeleteTripCommand";

export class CommandFactory {
  static create(toolCall: any): Command {
    switch (toolCall.tool) {
      case "save_email_data":
        return new SaveEmailDataCommand(
          toolCall.args.user_id,
          toolCall.args.sender_email,
          toolCall.args.recipient_email,
          toolCall.args.subject,
          toolCall.args.received_at,
          toolCall.args.trip_id
        );

      case "create_itinerary_item":
        return new CreateItineraryItemCommand(
          toolCall.args.trip_id,
          toolCall.args.activity_type,
          toolCall.args.title,
          toolCall.args.description,
          toolCall.args.location,
          toolCall.args.start_timestamp,
          toolCall.args.end_timestamp,
          toolCall.args.ordinal || 0,
          toolCall.args.source_email_id,
          toolCall.args.metadata
        );

      case "edit_itinerary_item":
        return new EditItineraryItemCommand(toolCall.args.item_id, {
          title: toolCall.args.title,
          description: toolCall.args.description,
          location: toolCall.args.location,
          start_timestamp: toolCall.args.start_timestamp,
          end_timestamp: toolCall.args.end_timestamp,
          ordinal: toolCall.args.ordinal,
          status: toolCall.args.status,
          metadata: toolCall.args.metadata,
        });

      case "create_trip":
        return new CreateTripCommand(
          toolCall.args.user_id,
          toolCall.args.name,
          toolCall.args.destination,
          toolCall.args.start_date,
          toolCall.args.end_date,
          toolCall.args.description
        );

      case "fetch_trips":
        return new FetchTripsCommand(toolCall.args.user_id);

      case "fetch_itinerary_items":
        return new FetchItineraryItemsCommand(toolCall.args.trip_id);

      case "edit_trip":
        return new EditTripCommand(toolCall.args.trip_id, {
          name: toolCall.args.name,
          destination: toolCall.args.destination,
          start_date: toolCall.args.start_date,
          end_date: toolCall.args.end_date,
          description: toolCall.args.description,
          status: toolCall.args.status,
        });

      case "delete_itinerary_item":
        return new DeleteItineraryItemCommand(toolCall.args.item_id);

      case "delete_trip":
        return new DeleteTripCommand(toolCall.args.trip_id);

      default:
        throw new Error(`Unknown tool: ${toolCall.tool}`);
    }
  }
}
