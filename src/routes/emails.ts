import { Router } from "express";
import { Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { EmailRepository } from "../repositories/EmailRepository";
import { TripRepository } from "../repositories/TripRepository";
import { ItineraryRepository } from "../repositories/ItineraryRepository";

const router = Router();

// All email routes require authentication
router.use(authMiddleware);

/**
 * GET /emails/review/count
 * Returns the number of emails in the review queue (for the nav badge).
 * Declared before /:id to prevent "review" being matched as an id param.
 */
router.get("/review/count", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const count = await EmailRepository.getReviewQueueCountByUserId(req.user!.id);
    return res.json({ count });
  } catch (err: any) {
    console.error("Review count error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /emails/review
 * Returns all emails with status 'in_review' for the authenticated user.
 */
router.get("/review", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emails = await EmailRepository.getEmailsInReviewByUserId(req.user!.id);
    return res.json({ emails });
  } catch (err: any) {
    console.error("Review queue error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /emails/:id/confirm
 * User has reviewed and confirmed the parsed email data.
 * Creates the trip (if new) and itinerary items, then marks the email as parsed.
 *
 * Body: {
 *   trip_id: string | null,       // existing trip UUID, or null to create new
 *   trip?: { name, destination?, start_date?, end_date?, description? },
 *   items: Array<{
 *     activity_type, title, description?, location?,
 *     start_timestamp?, end_timestamp?, metadata?
 *   }>
 * }
 */
router.post("/:id/confirm", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const emailId = req.params.id as string;
    const { trip_id, trip: tripData, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items must be a non-empty array" });
    }

    // Verify the email exists, belongs to this user, and is in review
    const email = await EmailRepository.getEmailMessageById(emailId);
    if (!email) {
      return res.status(404).json({ error: "Email not found" });
    }
    if (email.user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (email.parsed_status !== "in_review") {
      return res.status(400).json({ error: "Email is not in review status" });
    }

    // Resolve trip — use existing or create new
    let resolvedTripId: string;
    let resolvedTrip: any;

    if (trip_id) {
      const existingTrip = await TripRepository.getTripById(trip_id);
      if (!existingTrip || existingTrip.user_id !== userId) {
        return res.status(400).json({ error: "Trip not found or not authorized" });
      }
      resolvedTripId = existingTrip.id;
      resolvedTrip = existingTrip;
    } else {
      const name = tripData?.name?.trim();
      if (!name) {
        return res.status(400).json({ error: "trip.name is required when trip_id is not provided" });
      }
      resolvedTrip = await TripRepository.createTrip(
        userId,
        name,
        tripData.destination || undefined,
        tripData.start_date || undefined,
        tripData.end_date || undefined,
        tripData.description || undefined
      );
      resolvedTripId = resolvedTrip.id;
    }

    // Create itinerary items from the reviewed data
    let itemsCreated = 0;
    for (const item of items) {
      try {
        const activityType = await ItineraryRepository.getActivityTypeBySlug(item.activity_type);
        const typeId = activityType
          ? activityType.id
          : (await ItineraryRepository.getActivityTypeBySlug("event"))!.id;

        await ItineraryRepository.createItineraryItem(
          resolvedTripId,
          typeId,
          item.title || "Untitled",
          item.description || undefined,
          item.location || undefined,
          item.start_timestamp || undefined,
          item.end_timestamp || undefined,
          0,
          emailId,
          item.metadata || undefined
        );
        itemsCreated++;
      } catch (itemErr: any) {
        console.error(`[emails/confirm] Failed to create item "${item.title}":`, itemErr.message);
      }
    }

    // Associate email with trip and mark as parsed
    await EmailRepository.associateEmailWithTrip(emailId, resolvedTripId);
    await EmailRepository.markEmailAsVerified(emailId);

    return res.json({ success: true, trip_id: resolvedTripId, trip: resolvedTrip, items_created: itemsCreated });
  } catch (err: any) {
    console.error("Confirm email error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
