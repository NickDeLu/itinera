import { Router, Request, Response } from "express";
import crypto from "crypto";
import multer from "multer";
import { EmailRepository } from "../repositories/EmailRepository";
import { UserEmailRepository } from "../repositories/UserEmailRepository";
import { EmailProcessorService } from "../services/EmailProcessorService";

const router = Router();

// Multer handles multipart/form-data (which is what Mailgun sends)
const upload = multer({ storage: multer.memoryStorage() });

// Mailgun signing key from environment (optional, for webhook verification)
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || "";

/**
 * Verify Mailgun webhook signature.
 * Mailgun signs webhooks using HMAC-SHA256 of (timestamp + token) with the API key.
 */
function verifyMailgunSignature(
  timestamp: string,
  token: string,
  signature: string
): boolean {
  if (!MAILGUN_API_KEY) {
    console.warn(
      "[mailgun] MAILGUN_API_KEY not set — skipping webhook signature verification"
    );
    return true;
  }

  const encoded = crypto
    .createHmac("sha256", MAILGUN_API_KEY)
    .update(timestamp + token)
    .digest("hex");

  return encoded === signature;
}

/**
 * POST /webhooks/mailgun/inbound
 *
 * Receives inbound email data from Mailgun's "Send a sample POST" feature
 * or from a real Mailgun route webhook.
 *
 * Flow:
 *   1. Verify signature (if present)
 *   2. Extract sender email (the user who forwarded the email)
 *   3. Look up user by sender email in user_emails whitelist
 *   4. If user found → save email to DB → fire-and-forget AI processing
 *   5. If user NOT found → discard silently (spam protection)
 *   6. Always return 200 to Mailgun (stops retries)
 */
router.post("/inbound", upload.any(), async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, string>;

    // --- Signature verification ---
    const { timestamp, token, signature } = body;

    if (timestamp && token && signature) {
      if (!verifyMailgunSignature(timestamp, token, signature)) {
        console.error("[mailgun] Invalid webhook signature");
        return res.status(403).json({ error: "Invalid signature" });
      }
      console.log("[mailgun] Webhook signature verified");
    } else {
      console.log(
        "[mailgun] No signature fields present — likely a sample POST, skipping verification"
      );
    }

    // --- Extract email fields ---
    const sender = body.sender || body.from || "";
    const recipient = body.recipient || body.to || "";
    const subject = body.subject || "(no subject)";
    const bodyPlain = body["body-plain"] || body["stripped-text"] || "";
    const bodyHtml = body["body-html"] || body["stripped-html"] || "";
    const cc = body.cc || "";
    const attachments = body["attachment-count"] ? parseInt(body["attachment-count"], 10) : 0;
    const messageUrl = body["message-url"] || "";
    const messageHeaders = body["message-headers"] || "";

    // Log the parsed email
    console.log("[mailgun] Email received:", {
      sender,
      recipient,
      subject,
      bodyPreview: bodyPlain.substring(0, 200),
      attachments,
    });

    // --- Look up user by sender email ---
    // The sender is the user who forwarded the email to itinera.space.
    // We check if this sender email is in the user_emails whitelist.
    const userId = await UserEmailRepository.findUserIdByEmail(sender);

    if (!userId) {
      // No user has whitelisted this sender email — discard silently
      console.log(`[mailgun] No user found for sender "${sender}" — discarding`);
      return res.status(200).json({
        message: "Email received (no matching user)",
        status: "ok",
      });
    }

    console.log(`[mailgun] Found user ${userId} for sender "${sender}"`);

    // --- Save to database with real user_id ---
    let emailId: string;
    try {
      const emailMessage = await EmailRepository.saveEmailMessage(
        userId,
        sender || undefined,
        recipient || undefined,
        subject || undefined,
        bodyPlain || undefined,
        new Date().toISOString()
      );
      emailId = emailMessage.id;
      console.log("[mailgun] Email saved to database with ID:", emailId);
    } catch (dbError) {
      console.error("[mailgun] Failed to save email to database:", dbError);
      return res.status(200).json({
        message: "Email received (save failed)",
        status: "ok",
      });
    }

    // --- Fire-and-forget AI processing ---
    // Don't await — Mailgun gets 200 immediately, processing happens in background
    EmailProcessorService.processEmail(emailId, userId).catch((err) => {
      console.error(`[mailgun] Background processing failed for email ${emailId}:`, err.message);
    });

    // --- Acknowledge receipt (200 OK stops Mailgun retries) ---
    return res.status(200).json({
      message: "Email received successfully",
      status: "ok",
      email_id: emailId,
    });
  } catch (err: any) {
    console.error("[mailgun] Webhook error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;