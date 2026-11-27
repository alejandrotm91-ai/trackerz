/**
 * Cruce de la Certificación (Planillas, hojas de la Sábana) con las familias de equipo de T₃ (decisión del 28-nov-2026).
 *
 * Llave: columna H de la Sábana (PARTIDA) = id.Orig del Master = campo de usuario «32. Variacion» de la actividad
 * (de la .E, si no de la .D o la .F), normalizada como en Arrivals (`normLlave`). Regla de los duplicados (p. ej.
 * partida 16, donde la H se repite): si hay varias hojas con la misma H, se toman las del mismo capítulo (primer
 * tramo del código de la Sábana = primer tramo del Activity ID) y, entre ellas, la de código = Activity ID sin
 * .D/.E/.F; si queda una sola del capítulo, esa. Sin H que cruce, por código = Activity ID. Solo hojas EQ / EE.
 *
 * % certificado = acumulado ÷ contrato de la hoja. Lo esperado según T₃: 80 % si el flete (.E) ya empezó, más
 * 5 % del 20 % si la instalación (.F) empezó y el 20 % completo si terminó.
 */
import { celda } from './xer';
import type { ModeloP6 } from './modelo';
import { normLlave } from './llegadas';
import type { PlanillaItem } from '../../types';

export interface CertFamilia {
  iD: number;
  iE: number;
  iF: number | null;
  base: string;
  codCert: string;
  partida: string;
  via: 'H' | 'H+cod' | 'H+capítulo' | 'cod';
  contrato: number;
  certificado: number;
  /** Fracción certificada (0–1+). */
  p: number;
}

export function cruzarCertificacion(m: ModeloP6, hojas: PlanillaItem[], familias: Map<number, number>): Map<number, CertFamilia> {
  const t = m.task;
  const eq = hojas.filter(h => h.tipoG === 'EQ' || h.tipoG === 'EE');
  const porH = new Map<string, PlanillaItem[]>();
  for (const h of eq) { const k = normLlave(h.partida); if (!k) continue; if (!porH.has(k)) porH.set(k, []); porH.get(k)!.push(h); }
  const porCodCert = new Map(eq.map(h => [String(h.cod).trim(), h]));
  const capitulo = (c: string) => String(c).trim().split('.')[0];

  const tipos = m.xer.tablas.get('UDFTYPE'), valores = m.xer.tablas.get('UDFVALUE');
  const tv = tipos?.filas.find(f => celda(tipos, f, 'table_name') === 'TASK' && celda(tipos, f, 'udf_type_label') === '32. Variacion');
  const idVar = tv ? celda(tipos!, tv, 'udf_type_id') : null;
  const variacion = new Map<string, string>();
  for (const f of valores?.filas || []) if (celda(valores!, f, 'udf_type_id') === idVar) variacion.set(celda(valores!, f, 'fk_id'), celda(valores!, f, 'udf_text') || celda(valores!, f, 'udf_number'));
  const varDe = (i: number | null | undefined) => (i == null ? '' : variacion.get(celda(t, t.filas[i], 'task_id')) || '');
  const porCod = new Map<string, number>();
  t.filas.forEach((f, i) => porCod.set(celda(t, f, 'task_code'), i));

  const out = new Map<number, CertFamilia>();
  for (const [iD, iE] of familias) {
    const base = celda(t, t.filas[iD], 'task_code').replace(/\.D$/, '');
    const iF = porCod.get(`${base}.F`) ?? null;
    const v = varDe(iE) || varDe(iD) || varDe(iF);
    let h: PlanillaItem | undefined; let via: CertFamilia['via'] = 'H';
    const cands = porH.get(normLlave(v)) || [];
    if (cands.length === 1) h = cands[0];
    else if (cands.length > 1) {
      const mismoCap = cands.filter(c => capitulo(c.cod) === capitulo(base));
      const exacta = mismoCap.find(c => String(c.cod).trim() === base) || cands.find(c => String(c.cod).trim() === base);
      if (exacta) { h = exacta; via = 'H+cod'; } else if (mismoCap.length === 1) { h = mismoCap[0]; via = 'H+capítulo'; }
    }
    if (!h && porCodCert.has(base)) { h = porCodCert.get(base); via = 'cod'; }
    if (!h || !(h.contrato > 0)) continue;
    out.set(iD, { iD, iE, iF, base, codCert: String(h.cod), partida: h.partida || '', via, contrato: h.contrato, certificado: h.acum || 0, p: (h.acum || 0) / h.contrato });
  }
  return out;
}
