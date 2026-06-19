import { Router } from "express";
import { Response } from "express";
import { supabaseAdmin } from "../database";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { UserEmailRepository } from "../repositories/UserEmailRepository";

const router = Router();

/**
 * POST /auth/signup
 * Register a new user with email and password
 * Returns user info (user must log in to get tokens)
 */
router.post("/signup", async (req: AuthenticatedRequest, res: Response) => {
  const { email, password, full_name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Skip email verification for MVP
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || "Failed to create user" });
    }

    // Create user profile in database
    const { error: profileError } = await supabaseAdmin.from("users").insert({
      id: authData.user.id,
      email,
      full_name: full_name || null,
    });

    if (profileError) {
      console.error("Signup profile insert failed:", profileError, {
        userId: authData.user.id,
        email,
      });
      // Clean up auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return res.status(400).json({
        error: profileError.message || "Failed to create user profile",
        detail: profileError.details || undefined,
      });
    }

    // Auto-add signup email to trusted user_emails whitelist
    try {
      await UserEmailRepository.addEmail(authData.user.id, email, true);
      console.log("[auth] Auto-added email to user_emails:", email);
    } catch (emailError) {
      // Non-fatal: don't fail signup if this step fails, just log
      console.error("[auth] Failed to auto-add email to user_emails:", emailError);
    }

    return res.status(201).json({
      message: "User created successfully. Please log in to get access token.",
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
    });
  } catch (err) {
    console.error("Signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /auth/login
 * Login with email and password
 * Returns access token and refresh token
 */
router.post("/login", async (req: AuthenticatedRequest, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    // Use the regular auth API for login, not admin
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data || !data.session || !data.user) {
      console.error("Login failed, no session returned:", { error, data });
      return res.status(401).json({ error: error?.message || "Invalid credentials or session not returned" });
    }

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: "bearer",
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /auth/refresh
 * Refresh the access token using a refresh token
 * Returns new access token
 */
router.post("/refresh", async (req: AuthenticatedRequest, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "Refresh token is required" });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.refreshSession({
      refresh_token,
    });

    if (error || !data || !data.session) {
      console.error("Refresh failed, no session returned:", { error, data });
      return res.status(401).json({ error: "Invalid refresh token or session not returned" });
    }

    return res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        token_type: "bearer",
      },
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /auth/me
 * Get current authenticated user
 * Requires valid access token in Authorization header
 */
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const { data, error } = await supabaseAdmin.from("users").select("*").eq("id", req.user.id).single();

    if (error || !data) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json(data);
  } catch (err) {
    console.error("Get user error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
