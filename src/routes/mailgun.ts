import { Router, Request, Response } from "express";
import crypto from "crypto";
import multer from "multer";
import { EmailRepository } from "../repositories/EmailRepository";

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
 * Mailgun sends multipart/form-data with fields like:
 *   - from, to, cc, subject
 *   - body-plain, body-html, stripped-text, stripped-html
 *   - sender, recipient
 *   - attachments (count), message-headers (JSON), message-url
 *   - timestamp, token, signature (for signature verification)
 *   - attachment-1, attachment-2, ... (file attachments)
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
      messageUrl,
    });

    // --- Save to database ---
    try {
      const emailMessage = await EmailRepository.saveEmailMessage(
        "00000000-0000-0000-0000-000000000000", // placeholder — replace with user lookup
        sender || undefined,
        recipient || undefined,
        subject || undefined,
        new Date().toISOString()
      );
      console.log("[mailgun] Email saved to database with ID:", emailMessage.id);
    } catch (dbError) {
      // Don't fail the webhook if DB save fails — log and continue
      console.error("[mailgun] Failed to save email to database:", dbError);
    }

    // --- Acknowledge receipt (200 OK stops Mailgun retries) ---
    return res.status(200).json({
      message: "Email received successfully",
      status: "ok",
    });
  } catch (err: any) {
    console.error("[mailgun] Webhook error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;