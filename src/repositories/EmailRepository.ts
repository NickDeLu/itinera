import { supabaseAdmin } from "../database";

export interface EmailMessage {
  id: string;
  user_id: string;
  trip_id?: string;
  sender_email?: string;
  recipient_email?: string;
  subject?: string;
  body?: string;
  received_at?: string;
  parsed_status?: string | null; // 'in_review' | 'verified' | null (null until AI runs)
  parsed_data?: Record<string, any> | null;
  parsed_at?: string;
  created_at: string;
  updated_at: string;
}

const EMPTY_PARSED_DATA = {
  trip_id: null,
  trip: {},
  items: [],
  review_reasons: ["AI parsing failed — please fill in the activity details manually"],
};

export class EmailRepository {
  static async saveEmailMessage(
    userId: string,
    senderEmail?: string,
    recipientEmail?: string,
    subject?: string,
    body?: string,
    receivedAt?: string,
    tripId?: string
  ): Promise<EmailMessage> {
    const { data, error } = await supabaseAdmin
      .from("email_messages")
      .insert({
        user_id: userId,
        sender_email: senderEmail,
        recipient_email: recipientEmail,
        subject,
        body,
        received_at: receivedAt,
        trip_id: tripId,
        // parsed_status is null until AI processing completes
      })
      .select()
      .single();

    if (error)
      throw new Error(`Failed to save email message: ${error.message}`);
    return data;
  }

  static async getEmailMessageById(messageId: string): Promise<EmailMessage | null> {
    const { data, error } = await supabaseAdmin
      .from("email_messages")
      .select("*")
      .eq("id", messageId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to fetch email message: ${error.message}`);
    }
    return data || null;
  }

  static async getEmailMessagesByUserId(userId: string): Promise<EmailMessage[]> {
    const { data, error } = await supabaseAdmin
      .from("email_messages")
      .select("*")
      .eq("user_id", userId)
      .order("received_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch email messages: ${error.message}`);
    return data || [];
  }

  static async getEmailMessagesByTripId(tripId: string): Promise<EmailMessage[]> {
    const { data, error } = await supabaseAdmin
      .from("email_messages")
      .select("*")
      .eq("trip_id", tripId)
      .order("received_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch email messages: ${error.message}`);
    return data || [];
  }

  static async getEmailsInReviewByUserId(userId: string): Promise<EmailMessage[]> {
    const { data, error } = await supabaseAdmin
      .from("email_messages")
      .select("*")
      .eq("user_id", userId)
      .eq("parsed_status", "in_review")
      .order("received_at", { ascending: false });

    if (error) throw new Error(`Failed to fetch review queue: ${error.message}`);
    return data || [];
  }

  static async getReviewQueueCountByUserId(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from("email_messages")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("parsed_status", "in_review");

    if (error) throw new Error(`Failed to count review queue: ${error.message}`);
    return count || 0;
  }

  static async updateEmailMessage(
    messageId: string,
    updates: Partial<EmailMessage>
  ): Promise<EmailMessage> {
    const { data, error } = await supabaseAdmin
      .from("email_messages")
      .update(updates)
      .eq("id", messageId)
      .select()
      .single();

    if (error)
      throw new Error(`Failed to update email message: ${error.message}`);
    return data;
  }

  static async markEmailAsVerified(messageId: string): Promise<EmailMessage> {
    return this.updateEmailMessage(messageId, {
      parsed_status: "verified",
      parsed_at: new Date().toISOString(),
    });
  }

  static async routeEmailToReview(
    messageId: string,
    parsedData: Record<string, any>,
    reviewReasons: string[]
  ): Promise<EmailMessage> {
    return this.updateEmailMessage(messageId, {
      parsed_status: "in_review",
      parsed_data: { ...parsedData, review_reasons: reviewReasons },
    });
  }

  static async routeEmailToReviewWithEmptyData(
    messageId: string,
    reviewReasons: string[]
  ): Promise<EmailMessage> {
    return this.updateEmailMessage(messageId, {
      parsed_status: "in_review",
      parsed_data: { ...EMPTY_PARSED_DATA, review_reasons: reviewReasons },
    });
  }

  static async associateEmailWithTrip(messageId: string, tripId: string): Promise<EmailMessage> {
    return this.updateEmailMessage(messageId, {
      trip_id: tripId,
    });
  }

  static async deleteEmailMessage(messageId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("email_messages")
      .delete()
      .eq("id", messageId);

    if (error)
      throw new Error(`Failed to delete email message: ${error.message}`);
  }
}
