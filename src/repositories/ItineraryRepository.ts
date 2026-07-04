import { supabaseAdmin } from "../database";

export interface ItineraryItem {
  id: string;
  trip_id: string;
  activity_type_id: number;
  source_email_id?: string;
  title: string;
  description?: string;
  location?: string;
  start_timestamp?: string;
  end_timestamp?: string;
  ordinal: number;
  status: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export class ItineraryRepository {
  static async createItineraryItem(
    tripId: string,
    activityTypeId: number,
    title: string,
    description?: string,
    location?: string,
    startTimestamp?: string,
    endTimestamp?: string,
    ordinal: number = 0,
    sourceEmailId?: string,
    metadata?: Record<string, any>
  ): Promise<ItineraryItem> {
    const { data, error } = await supabaseAdmin
      .from("itinerary_items")
      .insert({
        trip_id: tripId,
        activity_type_id: activityTypeId,
        title,
        description,
        location,
        start_timestamp: startTimestamp,
        end_timestamp: endTimestamp,
        ordinal,
        source_email_id: sourceEmailId,
        metadata,
        status: "scheduled",
      })
      .select()
      .single();

    if (error)
      throw new Error(`Failed to create itinerary item: ${error.message}`);
    return data;
  }

  static async getItineraryItemById(itemId: string): Promise<ItineraryItem | null> {
    const { data, error } = await supabaseAdmin
      .from("itinerary_items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch itinerary item: ${error.message}`);
    }
    return data || null;
  }

  static async getItineraryItemsByTripId(tripId: string): Promise<ItineraryItem[]> {
    const { data, error } = await supabaseAdmin
      .from("itinerary_items")
      .select("*, activity_types(slug, label)")
      .eq("trip_id", tripId)
      .order("start_timestamp", { ascending: true });

    if (error) throw new Error(`Failed to fetch itinerary items: ${error.message}`);
    // Flatten the joined activity type into the item
    return (data || []).map((item: any) => ({
      ...item,
      activity_type: item.activity_types?.slug || item.activity_type || null,
      activity_type_label: item.activity_types?.label || null,
    }));
  }

  static async updateItineraryItem(
    itemId: string,
    updates: Partial<ItineraryItem>
  ): Promise<ItineraryItem> {
    const { data, error } = await supabaseAdmin
      .from("itinerary_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to update itinerary item: ${error.message}`);
    return data;
  }

  static async deleteItineraryItem(itemId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("itinerary_items")
      .delete()
      .eq("id", itemId);

    if (error)
      throw new Error(`Failed to delete itinerary item: ${error.message}`);
  }

  static async getActivityTypeBySlug(slug: string): Promise<{ id: number; slug: string; label: string } | null> {
    const { data, error } = await supabaseAdmin
      .from("activity_types")
      .select("*")
      .eq("slug", slug)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch activity type: ${error.message}`);
    }
    return data || null;
  }

  static async getAllActivityTypes(): Promise<{ id: number; slug: string; label: string }[]> {
    const { data, error } = await supabaseAdmin
      .from("activity_types")
      .select("*");

    if (error) throw new Error(`Failed to fetch activity types: ${error.message}`);
    return data || [];
  }
}
