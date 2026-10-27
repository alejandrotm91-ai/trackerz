import { Hono } from "hono";
import { requireAuth, requireAdmin, type AppEnv } from "./auth";

// Almacén en D1 para el cronograma ("master") y la matriz de personal ("personal").
// Subida: el navegador manda cada trozo por separado y al final "confirma" el plan;
// recién ahí pasa a ser el plan vigente y se borran los anteriores.
// El Worker guarda y devuelve el texto JSON tal cual, sin procesarlo.

const KINDS = new Set(["master", "personal"]);
const ID_RE = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_CHUNK_CHARS = 1_800_000; // D1 acepta filas de hasta 2 MB

export const cloudRoutes = new Hono<AppEnv>();

function badParams(kind: string, ...ids: string[]) {
  return !KINDS.has(kind) || ids.some((id) => !ID_RE.test(id));
}

// Plan vigente: { id, meta }
cloudRoutes.get("/:kind/active", requireAuth, async (c) => {
  const kind = c.req.param("kind");
  if (badParams(kind)) return c.json({ error: "Parámetros inválidos." }, 400);
  const row = await c.env.DB.prepare(
    "SELECT id, meta FROM cloud_plans WHERE kind = ? ORDER BY updated_at DESC LIMIT 1"
  ).bind(kind).first<{ id: string; meta: string }>();
  if (!row) return c.json({ error: "No hay datos publicados." }, 404);
  return c.body(`{"id":${JSON.stringify(row.id)},"meta":${row.meta}}`, 200, { "Content-Type": "application/json" });
});

// Todos los trozos de una sección, como lista JSON: [trozo0, trozo1, ...]
cloudRoutes.get("/:kind/:planId/:section", requireAuth, async (c) => {
  const { kind, planId, section } = c.req.param();
  if (badParams(kind, planId, section)) return c.json({ error: "Parámetros inválidos." }, 400);
  const { results } = await c.env.DB.prepare(
    "SELECT data FROM cloud_chunks WHERE plan_id = ? AND section = ? ORDER BY idx"
  ).bind(planId, section).all<{ data: string }>();
  return c.body(`[${results.map((r) => r.data).join(",")}]`, 200, { "Content-Type": "application/json" });
});

// Guarda un trozo (el cuerpo es el JSON del trozo).
cloudRoutes.put("/:kind/:planId/:section/:idx", requireAdmin, async (c) => {
  const { kind, planId, section } = c.req.param();
  const idx = Number(c.req.param("idx"));
  if (badParams(kind, planId, section) || !Number.isInteger(idx) || idx < 0) {
    return c.json({ error: "Parámetros inválidos." }, 400);
  }
  const data = await c.req.text();
  if (!data || data.length > MAX_CHUNK_CHARS) return c.json({ error: "Trozo vacío o demasiado grande." }, 413);
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO cloud_chunks (kind, plan_id, section, idx, data) VALUES (?, ?, ?, ?, ?)"
  ).bind(kind, planId, section, idx, data).run();
  return c.json({ ok: true });
});

// Confirma el plan (el cuerpo son sus metadatos) y borra los anteriores del mismo tipo.
cloudRoutes.post("/:kind/:planId/commit", requireAdmin, async (c) => {
  const { kind, planId } = c.req.param();
  if (badParams(kind, planId)) return c.json({ error: "Parámetros inválidos." }, 400);
  const meta = await c.req.text();
  if (!meta || meta.length > MAX_CHUNK_CHARS) return c.json({ error: "Metadatos vacíos o demasiado grandes." }, 413);
  const now = new Date().toISOString();
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT OR REPLACE INTO cloud_plans (id, kind, meta, updated_at) VALUES (?, ?, ?, ?)"
    ).bind(planId, kind, meta, now),
    c.env.DB.prepare("DELETE FROM cloud_chunks WHERE kind = ? AND plan_id != ?").bind(kind, planId),
    c.env.DB.prepare("DELETE FROM cloud_plans WHERE kind = ? AND id != ?").bind(kind, planId),
  ]);
  return c.json({ ok: true, planId });
});

// Documentos sueltos (reportes de IA).
export const docRoutes = new Hono<AppEnv>();

docRoutes.get("/:key", requireAuth, async (c) => {
  const key = c.req.param("key");
  if (!ID_RE.test(key)) return c.json({ error: "Clave inválida." }, 400);
  const row = await c.env.DB.prepare("SELECT value FROM kv_docs WHERE key = ?").bind(key).first<{ value: string }>();
  if (!row) return c.json({ error: "No encontrado." }, 404);
  return c.body(row.value, 200, { "Content-Type": "application/json" });
});

docRoutes.put("/:key", requireAdmin, async (c) => {
  const key = c.req.param("key");
  if (!ID_RE.test(key)) return c.json({ error: "Clave inválida." }, 400);
  const value = await c.req.text();
  if (!value || value.length > MAX_CHUNK_CHARS) return c.json({ error: "Documento vacío o demasiado grande." }, 413);
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO kv_docs (key, value, updated_at) VALUES (?, ?, ?)"
  ).bind(key, value, new Date().toISOString()).run();
  return c.json({ ok: true });
});
