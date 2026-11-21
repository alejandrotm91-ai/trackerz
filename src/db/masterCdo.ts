import { eq } from 'drizzle-orm';
import type { Db } from './index.ts';
import { masterPlans, masterWeeks, masterItems } from './schema.ts';
import type { MasterCdoPlanDoc, MasterCdoWeek, MasterCdoItem } from '../types/masterCdo.ts';

// D1 permite como máximo 100 parámetros por consulta y ~100 KB por sentencia.
const MAX_PARAMS = 99;
const MAX_BYTES = 60_000;

function normalizeItem(item: MasterCdoItem): MasterCdoItem {
  return {
    ...item,
    wbs: item.wbs || '',
    idOrig: item.idOrig || '',
    activityId: item.activityId || '',
    descripcion: item.descripcion || '',
    unidad: item.unidad || '',
    cantidadPresupuesto: item.cantidadPresupuesto || 0,
    precio: item.precio || 0,
    step: item.step || 1,
    venta: item.venta || 0,
    subcontratista: item.subcontratista || '',
    pAc: item.pAc || '',
    cap: item.cap || '',
    scap: item.scap || '',
    proceso: item.proceso || '',
    status: item.status || '',
    esItemHoja: item.esItemHoja ?? true,
    wbsRaw: item.wbsRaw || '',
    wbsDesc: item.wbsDesc || '',
    macro: item.macro || '',
    grupo: item.grupo || '',
    tipo: item.tipo || '',
    partidas: item.partidas || '',
    componente: item.componente || '',
    unit: item.unit || '',
    ubicacion: item.ubicacion || '',
    resp: item.resp || '',
    notas: item.notas || '',
    cantidadesSemanales: item.cantidadesSemanales || {},
    ventasSemanales: item.ventasSemanales || {},
  };
}

/** Agrupa filas en lotes que respetan los límites de D1. */
function chunkRows<T>(rows: T[], columns: number, sizeOf: (row: T) => number): T[][] {
  const perStatement = Math.floor(MAX_PARAMS / columns);
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const row of rows) {
    const rowBytes = sizeOf(row);
    if (current.length > 0 && (current.length >= perStatement || bytes + rowBytes > MAX_BYTES)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(row);
    bytes += rowBytes;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export async function saveMasterPlanToDb(db: Db, planId: string, planData: MasterCdoPlanDoc, items: MasterCdoItem[]) {
  try {
    const planValues = {
      id: planId,
      fileName: planData.fileName,
      totalRows: planData.totalRows,
      updatedAt: planData.updatedAt,
      updatedBy: planData.updatedBy,
      totales: planData.totales,
    };

    const weekRows = (planData.semanas ?? []).map(w => ({
      id: `${planId}_${w.id}`, // prefijo con planId para garantizar unicidad
      planId,
      fecha: w.fecha,
      label: w.label,
      cerrada: w.cerrada || false,
    }));

    const itemRows = (items ?? []).map(item => {
      const normalized = normalizeItem(item);
      return {
        id: `${planId}_${item.id}`,
        planId,
        wbs: normalized.wbs,
        data: normalized,
      };
    });

    const statements: any[] = [
      db.insert(masterPlans).values(planValues).onConflictDoUpdate({
        target: masterPlans.id,
        set: {
          fileName: planValues.fileName,
          totalRows: planValues.totalRows,
          updatedAt: planValues.updatedAt,
          updatedBy: planValues.updatedBy,
          totales: planValues.totales,
        },
      }),
      db.delete(masterWeeks).where(eq(masterWeeks.planId, planId)),
      db.delete(masterItems).where(eq(masterItems.planId, planId)),
    ];

    for (const chunk of chunkRows(weekRows, 5, w => JSON.stringify(w).length)) {
      statements.push(db.insert(masterWeeks).values(chunk));
    }
    for (const chunk of chunkRows(itemRows, 4, r => JSON.stringify(r.data).length + 200)) {
      statements.push(db.insert(masterItems).values(chunk));
    }

    // db.batch() corre todo en una sola transacción: si algo falla, no queda un plan a medias.
    await db.batch(statements as [any, ...any[]]);
  } catch (error) {
    console.error("Database query failed (saveMasterPlanToDb):", error);
    throw new Error("Failed to save master plan to D1.", { cause: error });
  }
}

export async function getMasterPlanFromDb(db: Db, planId: string) {
  try {
    const plans = await db.select().from(masterPlans).where(eq(masterPlans.id, planId));
    if (plans.length === 0) return null;

    const plan = plans[0];
    const weeksData = await db.select().from(masterWeeks).where(eq(masterWeeks.planId, planId));
    const itemsData = await db.select().from(masterItems).where(eq(masterItems.planId, planId));

    const semanas: MasterCdoWeek[] = weeksData.map(w => ({
      id: w.id.replace(`${planId}_`, ''),
      fecha: w.fecha,
      label: w.label,
      cerrada: w.cerrada || false,
    }));

    const items: MasterCdoItem[] = itemsData.map(i => {
      const data = i.data as MasterCdoItem;
      return { ...data, id: i.id.replace(`${planId}_`, '') };
    });

    return {
      planDoc: {
        id: plan.id,
        fileName: plan.fileName,
        totalRows: plan.totalRows || 0,
        updatedAt: plan.updatedAt || '',
        updatedBy: plan.updatedBy || '',
        totales: plan.totales as any,
        semanas,
      } as MasterCdoPlanDoc,
      items,
    };
  } catch (error) {
    console.error("Database query failed (getMasterPlanFromDb):", error);
    throw new Error("Failed to load master plan from D1.", { cause: error });
  }
}
