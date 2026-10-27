import { sqliteTable, text, integer, real, index, primaryKey } from "drizzle-orm/sqlite-core";

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

// Almacén genérico de documentos grandes (cronograma, personal). Cada carga es un "plan"
// con sus datos partidos en trozos JSON (D1 limita cada fila a 2 MB).
export const cloudPlans = sqliteTable("cloud_plans", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // "master" | "personal"
  meta: text("meta").notNull(), // JSON
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("cloud_plans_kind_idx").on(t.kind)]);

export const cloudChunks = sqliteTable("cloud_chunks", {
  kind: text("kind").notNull(),
  planId: text("plan_id").notNull(),
  section: text("section").notNull(),
  idx: integer("idx").notNull(),
  data: text("data").notNull(), // JSON (lista o diccionario)
}, (t) => [primaryKey({ columns: [t.planId, t.section, t.idx] }), index("cloud_chunks_kind_idx").on(t.kind)]);

// Documentos sueltos clave → valor (por ejemplo, los reportes de IA).
export const kvDocs = sqliteTable("kv_docs", {
  key: text("key").primaryKey(),
  value: text("value").notNull(), // JSON
  updatedAt: text("updated_at").notNull(),
});
