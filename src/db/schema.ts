import { pgTable, text, boolean, doublePrecision, jsonb, timestamp } from "drizzle-orm/pg-core";

export const masterPlans = pgTable("master_plans", {
  id: text("id").primaryKey(),
  fileName: text("file_name").notNull(),
  totalRows: doublePrecision("total_rows").default(0),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
  totales: jsonb("totales"), // MasterCdoTotals
});

export const masterWeeks = pgTable("master_weeks", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => masterPlans.id).notNull(),
  fecha: text("fecha").notNull(),
  label: text("label").notNull(),
  cerrada: boolean("cerrada").default(false),
});

export const masterItems = pgTable("master_items", {
  id: text("id").primaryKey(),
  planId: text("plan_id").references(() => masterPlans.id).notNull(),
  wbs: text("wbs").notNull(),
  idOrig: text("id_orig").notNull(),
  activityId: text("activity_id"),
  descripcion: text("descripcion").notNull(),
  unidad: text("unidad"),
  cantidadPresupuesto: doublePrecision("cantidad_presupuesto").default(0),
  precio: doublePrecision("precio").default(0),
  step: doublePrecision("step").default(1),
  venta: doublePrecision("venta").default(0),
  subcontratista: text("subcontratista"),
  pAc: text("p_ac"),
  cap: text("cap"),
  scap: text("scap"),
  proceso: text("proceso"),
  status: text("status"),
  esItemHoja: boolean("es_item_hoja").default(true),
  wbsRaw: text("wbs_raw"),
  wbsDesc: text("wbs_desc"),
  macro: text("macro"),
  grupo: text("grupo"),
  tipo: text("tipo"),
  partidas: text("partidas"),
  componente: text("componente"),
  unit: text("unit"),
  ubicacion: text("ubicacion"),
  resp: text("resp"),
  notas: text("notas"),
  cantidadesSemanales: jsonb("cantidades_semanales").default('{}'),
  ventasSemanales: jsonb("ventas_semanales").default('{}'),
});

export const masterItemProgress = pgTable("master_item_progress", {
  id: text("id").primaryKey(), // composite of itemId + weekId
  itemId: text("item_id").references(() => masterItems.id).notNull(),
  weekId: text("week_id").references(() => masterWeeks.id).notNull(),
  cantidad: doublePrecision("cantidad").default(0),
  venta: doublePrecision("venta").default(0),
});
