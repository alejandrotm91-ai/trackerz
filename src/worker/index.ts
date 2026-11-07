import { Hono } from "hono";
import type { Env } from "./env";
import { authRoutes, requireAuth, requireAdmin, type AppEnv } from "./auth";
import { cloudRoutes, docRoutes } from "./cloud";
import { gestionaRoutes } from "./gestiona";
import { getDb } from "../db/index.ts";
import { saveMasterPlanToDb, getMasterPlanFromDb } from "../db/masterCdo.ts";
import { analyze, equipmentAnalyze, cronoReport, type LegacyRes } from "./ai";

const app = new Hono<AppEnv>();

app.get("/api/health", (c) => c.json({ status: "ok" }));

app.route("/api/auth", authRoutes);
app.route("/api/cloud", cloudRoutes);
app.route("/api/docs", docRoutes);
app.route("/api/gestiona", gestionaRoutes);

// Adapta los handlers de IA (estilo Express) a Hono.
function aiRoute(handler: (req: { body: any }, res: LegacyRes, env: Env) => Promise<void>) {
  return async (c: any) => {
    const body = await c.req.json().catch(() => ({}));
    let status = 200;
    let payload: unknown = {};
    const res: LegacyRes = {
      status(code) { status = code; return res; },
      json(data) { payload = data; },
    };
    await handler({ body }, res, c.env);
    return c.json(payload, status);
  };
}

// La IA cuesta dinero por consulta: solo usuarios con sesión.
app.post("/api/ai/analyze", requireAuth, aiRoute(analyze));
app.post("/api/ai/equipment-analyze", requireAuth, aiRoute(equipmentAnalyze));
app.post("/api/ai/crono-report", requireAdmin, aiRoute(cronoReport));

// Master CDO Sync API
app.post("/api/master-cdo/save", requireAdmin, async (c) => {
  try {
    const { planId, planData, items } = await c.req.json();
    if (!planId || !planData || !items) {
      return c.json({ error: "Missing required data" }, 400);
    }
    planData.updatedBy = c.get("user").username;
    await saveMasterPlanToDb(getDb(c.env.DB), planId, planData, items);
    return c.json({ success: true, message: "Plan saved successfully" });
  } catch (error: any) {
    console.error("Failed to save master plan:", error);
    return c.json({ error: error.message || "Failed to save master plan" }, 500);
  }
});

app.get("/api/master-cdo/load/:planId", requireAuth, async (c) => {
  try {
    const data = await getMasterPlanFromDb(getDb(c.env.DB), c.req.param("planId"));
    if (!data) return c.json({ error: "Plan not found" }, 404);
    return c.json(data);
  } catch (error: any) {
    console.error("Failed to load master plan:", error);
    return c.json({ error: error.message || "Failed to load master plan" }, 500);
  }
});

app.all("/api/*", (c) => c.json({ error: "Ruta no encontrada." }, 404));

// Cualquier otra ruta: archivos de la app (los sirve Cloudflare desde dist/).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
