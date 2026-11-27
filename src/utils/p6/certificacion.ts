/**
 * Cruce de la Certificación (Planillas, hojas de la Sábana) con las familias de equipo de T₃ (decisiones del 28-nov-2026).
 *
 * Llave: columna H de la Sábana (PARTIDA) = id.Orig del Master = campo de usuario «32. Variacion» de la actividad
 * (de la .E, si no de la .D o la .F), normalizada como en Arrivals (`normLlave`). Solo hojas EQ / EE.
 *
 * La Sábana parte una misma partida en varias filas con la misma H (p. ej. 6.8.6.1 y 6.8.6.3 «Sistema concentrador
 * de FOG»: la segunda sin contrato y con certificado; o 3.15.3.3 + 3.15.3.10 como ampliación). Por eso cada familia
 * toma TODAS las filas de su H (las del mismo capítulo que el Activity ID si las hay —el capítulo es el primer tramo
 * del código de la Sábana—, si no todas) y suma contrato y certificado: % certificado = Σ acumulado ÷ Σ contrato.
 * Si varias familias de T₃ comparten la misma H (y por tanto las mismas filas), todas toman ese mismo %: como el
 * cobro se calcula como % × Budgeted de cada familia, el certificado se reparte en proporción a su presupuesto y no
 * se cuenta dos veces. Sin H que cruce, por código de la Sábana = Activity ID (sin .D/.E/.F), con las filas de la
 * H de esa fila, siempre que ninguna otra familia de T₃ reclame esa H por su «32. Variacion».
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
  /** Códigos de la Sábana sumados y su columna H. */
  codCert: string;
  partida: string;
  via: 'H' | 'H (capítulo)' | 'cod';
  /** Filas de la Sábana sumadas y familias de T₃ que las comparten. */
  filas: number;
  compartida: number;
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

  // Familias y su llave
  const fams = [...familias].map(([iD, iE]) => {
    const base = celda(t, t.filas[iD], 'task_code').replace(/\.D$/, '');
    const iF = porCod.get(`${base}.F`) ?? null;
    return { iD, iE, iF, base, k: normLlave(varDe(iE) || varDe(iD) || varDe(iF)) };
  });
  const reclamadas = new Set(fams.map(f => f.k).filter(Boolean));

  // Filas de la Sábana de cada familia
  const elegidas = new Map<number, { filas: PlanillaItem[]; via: CertFamilia['via']; grupo: string }>();
  for (const f of fams) {
    let filas: PlanillaItem[] = [], via: CertFamilia['via'] = 'H', k = f.k;
    if (k && porH.has(k)) {
      const todas = porH.get(k)!;
      const cap = todas.filter(h => capitulo(h.cod) === capitulo(f.base));
      filas = cap.length && cap.length < todas.length ? cap : todas;
      if (cap.length && cap.length < todas.length) via = 'H (capítulo)';
    } else {
      const h = porCodCert.get(f.base);
      const kh = h ? normLlave(h.partida) : '';
      if (h && kh && !reclamadas.has(kh)) {
        const todas = porH.get(kh) || [h];
        const cap = todas.filter(x => capitulo(x.cod) === capitulo(f.base));
        filas = cap.length ? cap : todas; via = 'cod'; k = kh;
      }
    }
    if (filas.length) elegidas.set(f.iD, { filas, via, grupo: `${k}|${filas.map(h => h.cod).sort().join(',')}` });
  }
  // Familias que comparten las mismas filas
  const porGrupo = new Map<string, number>();
  for (const e of elegidas.values()) porGrupo.set(e.grupo, (porGrupo.get(e.grupo) || 0) + 1);

  const out = new Map<number, CertFamilia>();
  for (const f of fams) {
    const e = elegidas.get(f.iD);
    if (!e) continue;
    const contrato = e.filas.reduce((a, h) => a + (h.contrato || 0), 0);
    const certificado = e.filas.reduce((a, h) => a + (h.acum || 0), 0);
    if (!(contrato > 0)) continue;
    out.set(f.iD, {
      iD: f.iD, iE: familias.get(f.iD)!, iF: f.iF, base: f.base, codCert: e.filas.map(h => h.cod).join(' + '), partida: e.filas[0].partida || '',
      via: e.via, filas: e.filas.length, compartida: porGrupo.get(e.grupo) || 1, contrato, certificado, p: certificado / contrato,
    });
  }
  return out;
}

/** Fila de la Sábana (EQ / EE) que no entró en ninguna familia de T₃, con lo que dice el Master de su H. */
export interface CertSinCruce {
  cod: string;
  tipoG: string;
  partida: string;
  desc: string;
  unidad: string;
  contrato: number;
  certificado: number;
  qContrato: number;
  qAcum: number;
  /** Partidas del Master con id.Orig = H (actividades o rubros de una «p6»). */
  master: { activityId: string; desc: string; p6: string; enT3: boolean; subc: string; venta: number }[];
  motivo: string;
}

/** Familia de equipo de T₃ sin certificación cruzada. */
export interface FamiliaSinCert {
  base: string;
  nombre: string;
  subc: string;
  variacion: string;
  estados: string;
  budgeted: number;
  actual: number;
  remaining: number;
  motivo: string;
}

export interface PartidaMaster {
  activityId: string | null;
  idOrig?: string | null;
  descripcion: string;
  subcontratista?: string;
  venta: number;
  hijosP6?: { activityId: string; idOrig: string; descripcion: string; subcontratista?: string; venta: number }[];
}

/**
 * Lo que no cruzó entre la Certificación (Sábana EQ / EE) y T₃, para revisarlo (decisión del 28-nov-2026):
 *  - filas de la Sábana con contrato o certificado que no entraron en ninguna familia .D/.E/.F, con las partidas
 *    del Master que tienen esa H como id.Orig (si es un rubro de una «p6», cuál) y el motivo;
 *  - familias de equipo de T₃ sin certificación (sin «32. Variacion», H que no está en la Sábana o contrato 0).
 */
export function sinCruceCertificacion(
  m: ModeloP6, hojas: PlanillaItem[], familias: Map<number, number>, cert: Map<number, CertFamilia>,
  master: PartidaMaster[], costo: (i: number | null) => { b: number; a: number; r: number }, subcDe: (i: number) => string,
): { certificacion: CertSinCruce[]; familias: FamiliaSinCert[] } {
  const t = m.task;
  const eq = hojas.filter(h => h.tipoG === 'EQ' || h.tipoG === 'EE');
  const usadas = new Set<string>();
  for (const c of cert.values()) for (const k of c.codCert.split(' + ')) usadas.add(k.trim());
  const porCod = new Map<string, number>();
  t.filas.forEach((f, i) => porCod.set(celda(t, f, 'task_code'), i));
  const enT3 = (cod: string) => porCod.has(cod) || ['D', 'E', 'F'].some(s => porCod.has(`${cod}.${s}`));

  // Partidas del Master por id.Orig (actividades y rubros de las «p6»)
  const porH = new Map<string, CertSinCruce['master']>();
  const poner = (k: string, x: CertSinCruce['master'][number]) => { if (!k) return; if (!porH.has(k)) porH.set(k, []); porH.get(k)!.push(x); };
  for (const a of master) {
    const id = String(a.activityId || '').trim();
    if (id) poner(normLlave(String(a.idOrig ?? '')), { activityId: id, desc: a.descripcion || '', p6: '', enT3: enT3(id), subc: a.subcontratista || '', venta: a.venta || 0 });
    for (const h of a.hijosP6 || []) poner(normLlave(String(h.idOrig ?? '')), { activityId: String(h.activityId || '').trim(), desc: h.descripcion || '', p6: id, enT3: enT3(id), subc: h.subcontratista || '', venta: h.venta || 0 });
  }
  // H que reclaman las familias de T₃ (por su «32. Variacion») y las ya cruzadas
  const hCruzadas = new Set([...cert.values()].map(c => normLlave(c.partida)));

  const certificacion: CertSinCruce[] = [];
  for (const h of eq) {
    if (usadas.has(String(h.cod).trim())) continue;
    if (!(Math.abs(h.contrato || 0) > 0.005 || Math.abs(h.acum || 0) > 0.005)) continue;
    const k = normLlave(h.partida);
    const ms = k ? porH.get(k) || [] : [];
    let motivo: string;
    if (!k) motivo = 'No H (PARTIDA) in the Sábana';
    else if (hCruzadas.has(k)) motivo = 'Its H is matched to a family of another chapter (rows of the same chapter as the Activity ID are used)';
    else if (!ms.length) motivo = 'H not found as id.Orig in the Master';
    else if (ms.every(x => x.p6)) motivo = 'Rubro of a p6 activity of the Master (in T₃ it is the p6, not an equipment family .D/.E/.F)';
    else if (ms.some(x => !x.p6 && !x.enT3)) motivo = 'Master activity not in T₃ yet (see M₃ Only)';
    else motivo = 'Master activity in T₃, but no equipment family (.D/.E/.F) has this H in «32. Variacion»';
    certificacion.push({
      cod: String(h.cod), tipoG: h.tipoG, partida: h.partida || '', desc: h.desc || '', unidad: h.unidad || '', contrato: h.contrato || 0, certificado: h.acum || 0,
      qContrato: h.qContrato || 0, qAcum: h.qAcum || 0, master: ms, motivo,
    });
  }

  // Familias de equipo sin certificación
  const tipos = m.xer.tablas.get('UDFTYPE'), valores = m.xer.tablas.get('UDFVALUE');
  const tv = tipos?.filas.find(f => celda(tipos, f, 'table_name') === 'TASK' && celda(tipos, f, 'udf_type_label') === '32. Variacion');
  const idVar = tv ? celda(tipos!, tv, 'udf_type_id') : null;
  const variacion = new Map<string, string>();
  for (const f of valores?.filas || []) if (celda(valores!, f, 'udf_type_id') === idVar) variacion.set(celda(valores!, f, 'fk_id'), celda(valores!, f, 'udf_text') || celda(valores!, f, 'udf_number'));
  const varDe = (i: number | null | undefined) => (i == null ? '' : variacion.get(celda(t, t.filas[i], 'task_id')) || '');
  const hEnSabana = new Map<string, number>();
  for (const h of eq) { const k = normLlave(h.partida); if (k) hEnSabana.set(k, (hEnSabana.get(k) || 0) + (h.contrato || 0)); }
  const codSabana = new Set(eq.map(h => String(h.cod).trim()));
  const est = (i: number | null) => (i == null ? '' : celda(t, t.filas[i], 'status_code').replace('TK_', '').replace('NotStart', 'Not Started').replace('Active', 'In Progress').replace('Complete', 'Completed'));
  const fams: FamiliaSinCert[] = [];
  for (const [iD, iE] of familias) {
    if (cert.has(iD)) continue;
    const base = celda(t, t.filas[iD], 'task_code').replace(/\.D$/, '');
    const iF = porCod.get(`${base}.F`) ?? null;
    const v = varDe(iE) || varDe(iD) || varDe(iF);
    const k = normLlave(v);
    const cs = [costo(iD), costo(iE), costo(iF)];
    let motivo: string;
    if (!k) motivo = codSabana.has(base) ? 'No «32. Variacion»; its Activity ID is in the Sábana but that H is claimed by another family' : 'No «32. Variacion» in T₃ and its Activity ID is not a Sábana code';
    else if (!hEnSabana.has(k)) motivo = '«32. Variacion» not found as H in the Sábana (EQ / EE)';
    else motivo = 'Its H is in the Sábana with contract 0';
    fams.push({
      base, nombre: celda(t, t.filas[iD], 'task_name'), subc: subcDe(iE) || subcDe(iD), variacion: v,
      estados: `${est(iD)} / ${est(iE)}${iF != null ? ` / ${est(iF)}` : ''}`,
      budgeted: cs.reduce((s, c) => s + c.b, 0), actual: cs.reduce((s, c) => s + c.a, 0), remaining: cs.reduce((s, c) => s + c.r, 0), motivo,
    });
  }
  const num = (a: string, b: string) => a.localeCompare(b, 'es', { numeric: true });
  certificacion.sort((a, b) => a.motivo.localeCompare(b.motivo) || num(a.cod, b.cod));
  fams.sort((a, b) => a.motivo.localeCompare(b.motivo) || num(a.base, b.base));
  return { certificacion, familias: fams };
}
