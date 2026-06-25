import { supabaseAdmin } from "../database";

export interface UserEmail {
  id: string;
  user_id: string;
  email: string;
  verified: boolean;
  created_at: string;
}

export class UserEmailRepository {
  /**
   * Add a trusted email for a user.
   * If the email already exists for this user, it's a no-op.
   */
  static async addEmail(
    userId: string,
    email: string,
    verified: boolean = false
  ): Promise<UserEmail> {
    // Upsert: if the email already exists for this user, don't error
    const { data, error } = await supabaseAdmin
      .from("user_emails")
      .upsert(
        { user_id: userId, email: email.toLowerCase().trim(), verified },
        { onConflict: "email", ignoreDuplicates: false }
      )
      .select()
      .single();

    if (error)
      throw new Error(`Failed to add user email: ${error.message}`);
    return data;
  }

  /**
   * Look up a user by their trusted email address.
   * Returns the user_id if found, null otherwise.
   */
  static async findUserIdByEmail(email: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
      .from("user_emails")
      .select("user_id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      console.error("[UserEmailRepository] Lookup error:", error.message);
      return null;
    }
    return data?.user_id || null;
  }

  /**
   * Get all trusted emails for a user.
   */
  static async getEmailsByUserId(userId: string): Promise<UserEmail[]> {
    const { data, error } = await supabaseAdmin
      .from("user_emails")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error)
      throw new Error(`Failed to fetch user emails: ${error.message}`);
    return data || [];
  }

  /**
   * Remove a trusted email by its ID (only if owned by the user).
   */
  static async removeEmail(emailId: string, userId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("user_emails")
      .delete()
      .eq("id", emailId)
      .eq("user_id", userId);

    if (error)
      throw new Error(`Failed to remove user email: ${error.message}`);
    return true;
  }

  /**
   * Remove a trusted email by the email address itself.
   */
  static async removeEmailByAddress(email: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("user_emails")
      .delete()
      .eq("email", email.toLowerCase().trim());

    if (error)
      throw new Error(`Failed to remove user email: ${error.message}`);
    return true;
  }
}