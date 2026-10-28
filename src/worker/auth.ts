import { Hono, type MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SignJWT, jwtVerify } from "jose";
import type { Env } from "./env";

// Inicio de sesión propio: usuario + contraseña comprobados en el Worker.
// Las contraseñas viven como secretos de Cloudflare (nunca en el código):
//   ADMIN_PASSWORD  → usuario "admin" (puede publicar y modificar datos)
//   APP_PASSWORD    → cualquier otro usuario (solo consulta)
//   SESSION_SECRET  → firma la cookie de sesión

export type Role = "admin" | "viewer";
export interface AuthUser { username: string; role: Role }
export type AppEnv = { Bindings: Env; Variables: { user: AuthUser } };

const COOKIE = "trackerz_session";
const SESSION_DAYS = 7;

function secretKey(env: Env) {
  if (!env.SESSION_SECRET) throw new Error("Falta el secreto SESSION_SECRET.");
  return new TextEncoder().encode(env.SESSION_SECRET);
}

// Compara sin filtrar por tiempo cuántos caracteres coinciden.
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(ha), vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

async function readSession(c: any): Promise<AuthUser | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(c.env));
    if (typeof payload.sub !== "string" || (payload.role !== "admin" && payload.role !== "viewer")) return null;
    return { username: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await readSession(c);
  if (!user) return c.json({ error: "Sesión no iniciada o vencida." }, 401);
  c.set("user", user);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await readSession(c);
  if (!user) return c.json({ error: "Sesión no iniciada o vencida." }, 401);
  if (user.role !== "admin") return c.json({ error: "Solo el administrador puede hacer esto." }, 403);
  c.set("user", user);
  await next();
};

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const { username, password } = await c.req.json().catch(() => ({} as any));
  const name = String(username ?? "").trim();
  const pass = String(password ?? "");
  if (!name || !pass) return c.json({ error: "Ingrese usuario y contraseña." }, 400);
  if (!c.env.ADMIN_PASSWORD || !c.env.APP_PASSWORD) {
    return c.json({ error: "El servidor no tiene configuradas las contraseñas." }, 500);
  }

  let role: Role | null = null;
  if (name.toLowerCase() === "admin") {
    if (await safeEqual(pass, c.env.ADMIN_PASSWORD)) role = "admin";
  } else if (await safeEqual(pass, c.env.APP_PASSWORD)) {
    role = "viewer";
  }
  if (!role) return c.json({ error: "Usuario o contraseña incorrectos." }, 401);

  const token = await new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(name)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey(c.env));
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Strict",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return c.json({ username: name, role });
});

authRoutes.get("/me", async (c) => {
  const user = await readSession(c);
  if (!user) return c.json({ error: "Sin sesión." }, 401);
  return c.json(user);
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

// Segunda confirmación que pide la app antes de publicar en la nube.
authRoutes.post("/verify-admin", requireAdmin, async (c) => {
  const { password } = await c.req.json().catch(() => ({} as any));
  const ok = await safeEqual(String(password ?? ""), c.env.ADMIN_PASSWORD);
  // 403 (no 401): la sesión sigue válida, solo la contraseña es incorrecta
  if (!ok) return c.json({ error: "Contraseña incorrecta" }, 403);
  return c.json({ ok: true });
});
