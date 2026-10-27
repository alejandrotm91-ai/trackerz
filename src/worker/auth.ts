import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./env";

// Firebase firma los tokens con estas claves públicas de Google.
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

export type AuthUser = JWTPayload & { email?: string };

// Reemplaza a firebase-admin: verifica el token de Firebase sin necesitar Node.js.
export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: { user: AuthUser } }> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized: Missing token" }, 401);
  }
  const token = header.slice("Bearer ".length);
  const projectId = c.env.FIREBASE_PROJECT_ID;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) throw new Error("Token without subject");
    c.set("user", payload as AuthUser);
  } catch (error) {
    console.error("Error verifying Firebase ID token:", error);
    return c.json({ error: "Unauthorized: Invalid token" }, 401);
  }
  await next();
};
