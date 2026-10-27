import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// Base de datos D1 (SQLite). Los campos JSON se guardan como texto.
export const masterPlans = sqliteTable("master_plans", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  totalRows: real("total_rows").default(0),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
  totales: text("totales", { mode: "json" }), // MasterCdoTotals
});

export const masterWeeks = sqliteTable("master_weeks", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => masterPlans.id).notNull(),
  fecha: text("fecha").notNull(),
  label: text("label").notNull(),
  cerrada: integer("cerrada", { mode: "boolean" }).default(false),
}, (t) => [index("master_weeks_plan_idx").on(t.planId)]);

// Cada partida se guarda completa como JSON en `data`. D1 limita cada consulta a
// 100 parámetros, así que con ~30 columnas se necesitarían miles de consultas.
export const masterItems = sqliteTable("master_items", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => masterPlans.id).notNull(),
  wbs: text("wbs").notNull(),
  data: text("data", { mode: "json" }).notNull(), // MasterCdoItem
}, (t) => [index("master_items_plan_idx").on(t.planId)]);
