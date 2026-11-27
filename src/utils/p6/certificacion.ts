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
