import { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { UserEmailRepository } from "../repositories/UserEmailRepository";

const router = Router();

/**
 * GET /user/emails
 * List all trusted emails for the authenticated user.
 */
router.get("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emails = await UserEmailRepository.getEmailsByUserId(req.user!.id);
    return res.json({ emails });
  } catch (err: any) {
    console.error("[userEmails] GET error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /user/emails
 * Add a trusted email address for the authenticated user.
 * Body: { email: string }
 */
router.post("/", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "email is required" });
  }

  try {
    const userEmail = await UserEmailRepository.addEmail(req.user!.id, email, false);
    return res.status(201).json({ message: "Email added successfully", email: userEmail });
  } catch (err: any) {
    // Handle duplicate gracefully
    if (err.message?.includes("duplicate key") || err.code === "23505") {
      return res.status(409).json({ error: "Email already registered" });
    }
    console.error("[userEmails] POST error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /user/emails/:id
 * Remove a trusted email by its ID.
 */
router.delete("/:id", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const emailId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await UserEmailRepository.removeEmail(emailId, req.user!.id);
    return res.json({ message: "Email removed successfully" });
  } catch (err: any) {
    console.error("[userEmails] DELETE error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;