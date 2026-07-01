import { Router } from "express";
import { Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { TripRepository } from "../repositories/TripRepository";
import { ItineraryRepository } from "../repositories/ItineraryRepository";

const router = Router();

// All trip routes require authentication
router.use(authMiddleware);

/**
 * GET /trips
 * Fetch all trips for the authenticated user
 */
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const trips = await TripRepository.getTripsByUserId(userId);
    return res.json({ trips });
  } catch (err: any) {
    console.error("Fetch trips error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /trips/:id
 * Fetch a single trip with its itinerary items
 */
router.get("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tripId = req.params.id as string;

    const trip = await TripRepository.getTripById(tripId);
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }
    if (trip.user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const items = await ItineraryRepository.getItineraryItemsByTripId(tripId);

    return res.json({ trip, items });
  } catch (err: any) {
    console.error("Fetch trip error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /trips/:id
 * Delete a trip (and its itinerary items via cascade)
 */
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const tripId = req.params.id as string;

    const trip = await TripRepository.getTripById(tripId);
    if (!trip) {
      return res.status(404).json({ error: "Trip not found" });
    }
    if (trip.user_id !== userId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await TripRepository.deleteTrip(tripId);
    return res.json({ success: true });
  } catch (err: any) {
    console.error("Delete trip error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;