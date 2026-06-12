import { Request, Response, NextFunction } from "express";
import { createAuthenticatedClient } from "../database";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
  };
  supabase?: ReturnType<typeof createAuthenticatedClient>;
}

/**
 * Middleware to verify JWT token from Authorization header and attach user context
 * Expected header format: Authorization: Bearer <jwt_token>
 */
export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  try {
    // Verify token using Supabase
    const { data, error } = await createAuthenticatedClient(token).auth.getUser();

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Attach user context to request
    req.user = {
      id: data.user.id,
      email: data.user.email,
    };

    // Attach authenticated Supabase client to request
    req.supabase = createAuthenticatedClient(token);

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

/**
 * Optional middleware that doesn't error if no auth token is provided
 * Useful for routes that work with or without authentication
 */
export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(); // Continue without user context
  }

  const token = authHeader.slice(7);

  try {
    const { data, error } = await createAuthenticatedClient(token).auth.getUser();

    if (!error && data.user) {
      req.user = {
        id: data.user.id,
        email: data.user.email,
      };
      req.supabase = createAuthenticatedClient(token);
    }
  } catch (err) {
    console.error("Optional auth middleware error:", err);
    // Continue without user context on error
  }

  next();
};
