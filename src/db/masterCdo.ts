import { db } from './index.ts';
import { masterPlans, masterWeeks, masterItems, masterItemProgress } from './schema.ts';
import { eq } from 'drizzle-orm';
import type { MasterCdoPlanDoc, MasterCdoWeek, MasterCdoItem } from '../types/masterCdo.ts';

export async function saveMasterPlanToDb(planId: string, planData: MasterCdoPlanDoc, items: MasterCdoItem[]) {
  try {
    // Upsert Plan
    await db.insert(masterPlans)
      .values({
        id: planId,
        fileName: planData.fileName,
        totalRows: planData.totalRows,
        updatedAt: planData.updatedAt,
        updatedBy: planData.updatedBy,
        totales: planData.totales,
      })
      .onConflictDoUpdate({
        target: masterPlans.id,
        set: {
          fileName: planData.fileName,
          totalRows: planData.totalRows,
          updatedAt: planData.updatedAt,
          updatedBy: planData.updatedBy,
          totales: planData.totales,
        }
      });

    // Delete existing weeks and items for this plan to replace them
    // (A more optimized way is upserting, but replacing is easier to guarantee no stale data)
    await db.delete(masterWeeks).where(eq(masterWeeks.planId, planId));
    await db.delete(masterItems).where(eq(masterItems.planId, planId));

    // Insert Weeks
    if (planData.semanas && planData.semanas.length > 0) {
      await db.insert(masterWeeks).values(
        planData.semanas.map(w => ({
          id: `${planId}_${w.id}`, // prefix with planId to ensure uniqueness
          planId,
          fecha: w.fecha,
          label: w.label,
          cerrada: w.cerrada || false
        }))
      );
    }

    // Insert Items
    if (items && items.length > 0) {
      const itemsToInsert = items.map(item => ({
        id: `${planId}_${item.id}`,
        planId,
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
        ventasSemanales: item.ventasSemanales || {}
      }));
      
      // Batch insert items to avoid too many parameters in one query
      const chunkSize = 1000;
      for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        await db.insert(masterItems).values(itemsToInsert.slice(i, i + chunkSize));
      }
    }
  } catch (error) {
    console.error("Database query failed (saveMasterPlanToDb):", error);
    throw new Error("Failed to save master plan to SQL.", { cause: error });
  }
}

export async function getMasterPlanFromDb(planId: string) {
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
      cerrada: w.cerrada || false
    }));

    const items: MasterCdoItem[] = itemsData.map(i => ({
      id: i.id.replace(`${planId}_`, ''),
      wbs: i.wbs,
      idOrig: i.idOrig,
      activityId: i.activityId || '',
      descripcion: i.descripcion,
      unidad: i.unidad || '',
      cantidadPresupuesto: i.cantidadPresupuesto || 0,
      precio: i.precio || 0,
      step: i.step || 1,
      venta: i.venta || 0,
      subcontratista: i.subcontratista || '',
      pAc: i.pAc || '',
      cap: i.cap || '',
      scap: i.scap || '',
      proceso: i.proceso || '',
      status: i.status || '',
      esItemHoja: i.esItemHoja || false,
      wbsRaw: i.wbsRaw || '',
      wbsDesc: i.wbsDesc || '',
      macro: i.macro || '',
      grupo: i.grupo || '',
      tipo: i.tipo || '',
      partidas: i.partidas || '',
      componente: i.componente || '',
      unit: i.unit || '',
      ubicacion: i.ubicacion || '',
      resp: i.resp || '',
      notas: i.notas || '',
      cantidadesSemanales: (i.cantidadesSemanales || {}) as Record<string, number>,
      ventasSemanales: (i.ventasSemanales || {}) as Record<string, number>
    }));

    return {
      planDoc: {
        id: plan.id,
        fileName: plan.fileName,
        totalRows: plan.totalRows || 0,
        updatedAt: plan.updatedAt || '',
        updatedBy: plan.updatedBy || '',
        totales: plan.totales as any,
        semanas
      } as MasterCdoPlanDoc,
      items
    };
  } catch (error) {
    console.error("Database query failed (getMasterPlanFromDb):", error);
    throw new Error("Failed to load master plan from SQL.", { cause: error });
  }
}
