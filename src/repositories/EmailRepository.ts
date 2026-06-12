import { supabaseAdmin } from "../database";

export interface EmailMessage {
  id: string;
  user_id: string;
  trip_id?: string;
  sender_email?: string;
  recipient_email?: string;
  subject?: string;
  received_at?: string;
  parsed: boolean;
  parsed_at?: string;
  created_at: string;
  updated_at: string;
}

export class EmailRepository {
  static async saveEmailMessage(
    userId: string,
    senderEmail?: string,
    recipientEmail?: string,
    subject?: string,
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
        received_at: receivedAt,
        trip_id: tripId,
        parsed: false,
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

  static async markEmailAsParsed(messageId: string): Promise<EmailMessage> {
    return this.updateEmailMessage(messageId, {
      parsed: true,
      parsed_at: new Date().toISOString(),
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
