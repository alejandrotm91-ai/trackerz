import { Hono } from "hono";
import { requireAuth, requireAdmin, type AppEnv } from "./auth";

// Gestiona (actividades y reuniones de obra), guardado en D1 como documentos JSON
// por colección. Cualquier usuario con sesión puede consultar; solo el admin modifica.

const COLECCIONES = new Set([
  "projects",
  "activities",
  "members",
  "time_logs",
  "notifications",
  "meetings",
  "deleted_members",
]);
const ID_RE = /^[A-Za-z0-9_.:@ -]{1,160}$/;
const MAX_DOC_CHARS = 900_000;

export const gestionaRoutes = new Hono<AppEnv>();

function invalido(col: string, id?: string) {
  return !COLECCIONES.has(col) || (id !== undefined && !ID_RE.test(id));
}

// Todo el contenido: { projects: [...], activities: [...], ... }
gestionaRoutes.get("/", requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT coleccion, data FROM gestiona_docs").all<{ coleccion: string; data: string }>();
  const partes: Record<string, string[]> = {};
  for (const col of COLECCIONES) partes[col] = [];
  for (const r of results) (partes[r.coleccion] ||= []).push(r.data);
  const cuerpo = "{" + Object.entries(partes).map(([k, v]) => `${JSON.stringify(k)}:[${v.join(",")}]`).join(",") + "}";
  return c.body(cuerpo, 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
});

// Crear o reemplazar un registro
gestionaRoutes.put("/:col/:id", requireAdmin, async (c) => {
  const col = c.req.param("col");
  const id = decodeURIComponent(c.req.param("id"));
  if (invalido(col, id)) return c.json({ error: "Parámetros inválidos." }, 400);
  const texto = await c.req.text();
  if (!texto || texto.length > MAX_DOC_CHARS) return c.json({ error: "Registro vacío o demasiado grande." }, 413);
  try { JSON.parse(texto); } catch { return c.json({ error: "JSON inválido." }, 400); }
  await c.env.DB.prepare(
    "INSERT OR REPLACE INTO gestiona_docs (coleccion, id, data, updated_at) VALUES (?, ?, ?, ?)"
  ).bind(col, id, texto, new Date().toISOString()).run();
  return c.json({ ok: true });
});

// Borrar un registro
gestionaRoutes.delete("/:col/:id", requireAdmin, async (c) => {
  const col = c.req.param("col");
  const id = decodeURIComponent(c.req.param("id"));
  if (invalido(col, id)) return c.json({ error: "Parámetros inválidos." }, 400);
  await c.env.DB.prepare("DELETE FROM gestiona_docs WHERE coleccion = ? AND id = ?").bind(col, id).run();
  return c.json({ ok: true });
});
