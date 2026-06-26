import { VeniceService } from "./VeniceService";
import { EMAIL_PROCESSOR_PROMPT } from "../prompts/emailProcessorPrompt";
import { EmailRepository } from "../repositories/EmailRepository";
import { TripRepository } from "../repositories/TripRepository";
import { ItineraryRepository } from "../repositories/ItineraryRepository";

interface ExtractedTrip {
  name: string;
  destination: string | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

interface ExtractedItem {
  activity_type: string;
  title: string;
  description: string | null;
  location: string | null;
  start_timestamp: string | null;
  end_timestamp: string | null;
  metadata: Record<string, any>;
}

interface ExtractedData {
  trip_id: string | null; // null = create new trip, uuid = use existing
  trip: ExtractedTrip;
  items: ExtractedItem[];
}

export class EmailProcessorService {
  /**
   * Process a single email: send it to the AI, parse the response,
   * create a trip + itinerary items in the database.
   *
   * @param emailId - UUID of the email_message to process
   * @param userId  - UUID of the user who owns this email
   */
  static async processEmail(emailId: string, userId: string): Promise<void> {
    console.log(`[EmailProcessor] Processing email ${emailId} for user ${userId}`);

    // 1) Fetch the email from the database
    const email = await EmailRepository.getEmailMessageById(emailId);
    if (!email) {
      console.error(`[EmailProcessor] Email ${emailId} not found`);
      return;
    }

    // 2) Fetch user's existing trips so AI can decide to match
    const existingTrips = await TripRepository.getTripsByUserId(userId);
    console.log(`[EmailProcessor] User has ${existingTrips.length} existing trip(s)`);

    // 3) Build the AI prompt with email context + existing trips
    const userMessage = this.buildEmailMessage(email, existingTrips);
    const messages = [
      { role: "system" as const, content: EMAIL_PROCESSOR_PROMPT },
      { role: "user" as const, content: userMessage },
    ];

    // 4) Call the AI (single turn, no tool loop)
    let extracted: ExtractedData;
    try {
      const rawText = await this.callAIForExtraction(messages);
      extracted = this.parseAIResponse(rawText);
      console.log(`[EmailProcessor] AI parsed: trip_id=${extracted.trip_id || "new"}, items=${extracted.items.length}`);
    } catch (aiError: any) {
      console.error(`[EmailProcessor] AI parsing failed for email ${emailId}:`, aiError.message);
      // Save empty parsed_data so the review form has a valid (blank) structure to render
      await EmailRepository.routeEmailToReviewWithEmptyData(emailId, [
        "AI parsing failed — please fill in the activity details manually",
      ]);
      return;
    }

    // 4b) Routing decision — must come before any DB writes
    const { route, reasons } = this.shouldRouteToReview(extracted, existingTrips);
    if (route) {
      console.log(`[EmailProcessor] Routing email ${emailId} to review: ${reasons.join("; ")}`);
      await EmailRepository.routeEmailToReview(emailId, extracted, reasons);
      return;
    }

    // 5) Determine the trip — use existing or create new
    let tripId: string;
    try {
      if (extracted.trip_id) {
        // AI matched an existing trip — verify it exists and belongs to user
        const existingTrip = await TripRepository.getTripById(extracted.trip_id);
        if (existingTrip && existingTrip.user_id === userId) {
          tripId = existingTrip.id;
          console.log(`[EmailProcessor] Using existing trip ${tripId}: "${existingTrip.name}"`);
        } else {
          // AI returned invalid trip_id — route to review rather than silently creating a trip
          console.warn(`[EmailProcessor] AI returned invalid trip_id "${extracted.trip_id}" — routing to review`);
          await EmailRepository.routeEmailToReview(
            emailId,
            extracted,
            ["AI matched an invalid trip — please assign manually"]
          );
          return;
        }
      } else {
        // AI says this is a new trip
        const trip = await TripRepository.createTrip(
          userId,
          extracted.trip.name,
          extracted.trip.destination || undefined,
          extracted.trip.start_date || undefined,
          extracted.trip.end_date || undefined,
          extracted.trip.description || undefined
        );
        tripId = trip.id;
        console.log(`[EmailProcessor] Created new trip ${tripId}: "${extracted.trip.name}"`);
      }
    } catch (dbError: any) {
      console.error(`[EmailProcessor] Failed to find/create trip for email ${emailId}:`, dbError.message);
      await EmailRepository.markEmailAsVerified(emailId);
      return;
    }

    // 6) Create itinerary items for each extracted item
    for (const item of extracted.items) {
      try {
        // Resolve activity type slug → numeric ID
        const activityType = await ItineraryRepository.getActivityTypeBySlug(item.activity_type);
        if (!activityType) {
          console.warn(`[EmailProcessor] Unknown activity type "${item.activity_type}", using "event"`);
          const defaultType = await ItineraryRepository.getActivityTypeBySlug("event");
          if (!defaultType) {
            console.error(`[EmailProcessor] Cannot create item — no "event" activity type either`);
            continue;
          }
          await ItineraryRepository.createItineraryItem(
            tripId,
            defaultType.id,
            item.title,
            item.description || undefined,
            item.location || undefined,
            item.start_timestamp || undefined,
            item.end_timestamp || undefined,
            0, // ordinal
            emailId,   // source_email_id
            item.metadata || undefined
          );
        } else {
          await ItineraryRepository.createItineraryItem(
            tripId,
            activityType.id,
            item.title,
            item.description || undefined,
            item.location || undefined,
            item.start_timestamp || undefined,
            item.end_timestamp || undefined,
            0, // ordinal
            emailId,   // source_email_id
            item.metadata || undefined
          );
        }
        console.log(`[EmailProcessor] Created item "${item.title}" for trip ${tripId}`);
      } catch (itemError: any) {
        // Don't fail the whole batch for one bad item
        console.error(`[EmailProcessor] Failed to create item "${item.title}":`, itemError.message);
      }
    }

    // 7) Link the email to the trip and mark as parsed
    try {
      await EmailRepository.associateEmailWithTrip(emailId, tripId);
      await EmailRepository.markEmailAsVerified(emailId);
      console.log(`[EmailProcessor] Email ${emailId} processed successfully → trip ${tripId}`);
    } catch (updateError: any) {
      console.error(`[EmailProcessor] Failed to update email status:`, updateError.message);
    }
  }

  private static shouldRouteToReview(
    extracted: ExtractedData,
    existingTrips: any[]
  ): { route: boolean; reasons: string[] } {
    // No existing trips — always auto-create, no ambiguity
    if (existingTrips.length === 0) return { route: false, reasons: [] };

    const reasons: string[] = [];

    if (!extracted.trip_id) {
      reasons.push("Could not match email to an existing trip");
    }

    const missingTime = extracted.items.filter((i) => !i.start_timestamp);
    if (missingTime.length > 0) {
      reasons.push(`${missingTime.length} item(s) missing date/time information`);
    }

    return { route: reasons.length > 0, reasons };
  }

  /**
   * Call AI directly and collect the full raw text response.
   * Uses VeniceService but collects raw stream output instead of
   * going through ToolCallParser (which expects chat format with tools/text).
   */
  private static async callAIForExtraction(messages: any[]): Promise<string> {
    const stream = await VeniceService.chat(messages);

    return new Promise<string>((resolve, reject) => {
      let sseBuffer = "";
      let fullText = "";

      stream.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        sseBuffer += text;

        let boundary = sseBuffer.indexOf("\n\n");
        while (boundary !== -1) {
          const message = sseBuffer.slice(0, boundary).trim();
          sseBuffer = sseBuffer.slice(boundary + 2);

          if (message.startsWith("data: ")) {
            const jsonStr = message.replace(/^data: /, "");

            if (jsonStr === "[DONE]") {
              return;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta;
              if (delta?.content) {
                fullText += delta.content;
              }
            } catch {
              // Ignore parse errors for individual messages
            }
          }
          boundary = sseBuffer.indexOf("\n\n");
        }
      });

      stream.on("end", () => {
        resolve(fullText);
      });

      stream.on("error", (err: any) => {
        reject(new Error(`Stream error: ${err.message}`));
      });
    });
  }

  /**
   * Build a user-style message that includes the email context
   * and the user's existing trips so the AI can decide to match.
   */
  private static buildEmailMessage(email: any, existingTrips: any[]): string {
    const sections: string[] = [];

    // Existing trips section
    sections.push("USER'S EXISTING TRIPS:");
    if (existingTrips.length === 0) {
      sections.push("(no existing trips — you will create a new one)");
    } else {
      for (const trip of existingTrips) {
        sections.push(`- ID: ${trip.id} | Name: "${trip.name}" | Destination: ${trip.destination || "N/A"} | Dates: ${trip.start_date || "?"} → ${trip.end_date || "?"}`);
      }
    }
    sections.push("");

    // Forwarded email
    sections.push("--- BEGIN FORWARDED EMAIL ---");
    sections.push(`Subject: ${email.subject || "(no subject)"}`);
    sections.push(`From: ${email.sender_email || "(unknown sender)"}`);
    sections.push(`To: ${email.recipient_email || "(unknown recipient)"}`);
    sections.push(`Date: ${email.received_at || "(unknown date)"}`);
    sections.push("");
    sections.push("Body:");
    sections.push(email.body || "(no body content)");
    sections.push("--- END FORWARDED EMAIL ---");
    sections.push("");
    sections.push("Decide: does this email match an existing trip, or should a new trip be created?");
    sections.push("Then extract the structured data.");

    return sections.join("\n");
  }

  /**
   * Parse the AI's JSON response, with fallback for malformed output.
   */
  private static parseAIResponse(text: string): ExtractedData {
    // Try to find JSON block in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;

    const parsed = JSON.parse(jsonStr);

    // Validate structure
    if (!parsed.items) {
      throw new Error("AI response missing required 'items' field");
    }

    return {
      trip_id: parsed.trip_id || null,
      trip: {
        name: parsed.trip?.name || "Untitled Trip",
        destination: parsed.trip?.destination || null,
        start_date: parsed.trip?.start_date || null,
        end_date: parsed.trip?.end_date || null,
        description: parsed.trip?.description || null,
      },
      items: (parsed.items || []).map((item: any) => ({
        activity_type: item.activity_type || "event",
        title: item.title || "Untitled",
        description: item.description || null,
        location: item.location || null,
        start_timestamp: item.start_timestamp || null,
        end_timestamp: item.end_timestamp || null,
        metadata: item.metadata || {},
      })),
    };
  }
}