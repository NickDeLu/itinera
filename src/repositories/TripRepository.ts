import { supabaseAdmin } from "../database";

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export class TripRepository {
  static async createTrip(
    userId: string,
    name: string,
    destination?: string,
    startDate?: string,
    endDate?: string,
    description?: string
  ): Promise<Trip> {
    const { data, error } = await supabaseAdmin
      .from("trips")
      .insert({
        user_id: userId,
        name,
        destination,
        start_date: startDate,
        end_date: endDate,
        description,
        status: "active",
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create trip: ${error.message}`);
    return data;
  }

  static async getTripById(tripId: string): Promise<Trip | null> {
    const { data, error } = await supabaseAdmin
      .from("trips")
      .select("*")
      .eq("id", tripId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch trip: ${error.message}`);
    }
    return data || null;
  }

  static async getTripsByUserId(userId: string): Promise<Trip[]> {
    const { data, error } = await supabaseAdmin
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch trips: ${error.message}`);
    return data || [];
  }

  static async updateTrip(
    tripId: string,
    updates: Partial<Trip>
  ): Promise<Trip> {
    const { data, error } = await supabaseAdmin
      .from("trips")
      .update(updates)
      .eq("id", tripId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update trip: ${error.message}`);
    return data;
  }

  static async deleteTrip(tripId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("trips")
      .delete()
      .eq("id", tripId);

    if (error) throw new Error(`Failed to delete trip: ${error.message}`);
  }

  static async findTripByNameAndDate(
    userId: string,
    name: string,
    startDate?: string
  ): Promise<Trip | null> {
    let query = supabaseAdmin
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .eq("name", name);

    if (startDate) {
      query = query.eq("start_date", startDate);
    }

    const { data, error } = await query.single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to find trip: ${error.message}`);
    }
    return data || null;
  }
}
