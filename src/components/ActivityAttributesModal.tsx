/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Check, Tag, Layers, SlidersHorizontal, Info } from 'lucide-react';
import { MasterCdoItem } from '../types/masterCdo';
import { Actividad } from '../types';

interface ActivityAttributesModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MasterCdoItem | null;
  actividad?: Actividad | null;
  availableOptions: {
    macros: string[];
    grupos: string[];
    tipos: string[];
    partidas: string[];
    caps: string[];
    scaps: string[];
    subcs: string[];
    units: string[];
    componentes?: string[];
  };
  onSave: (itemId: string, activityId: string, updates: Partial<MasterCdoItem>) => void;
}

export function ActivityAttributesModal({
  isOpen,
  onClose,
  item,
  actividad,
  availableOptions,
  onSave
}: ActivityAttributesModalProps) {
  const [macro, setMacro] = useState<string>('');
  const [grupo, setGrupo] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [partidas, setPartidas] = useState<string>('');
  const [cap, setCap] = useState<string>('');
  const [scap, setScap] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [componente, setComponente] = useState<string>('');
  const [subcontratista, setSubcontratista] = useState<string>('');
  const [proceso, setProceso] = useState<string>('');
  const [ubicacion, setUbicacion] = useState<string>('');
  const [resp, setResp] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  useEffect(() => {
    if (item) {
      setMacro(item.macro || actividad?.macro || '');
      setGrupo(item.grupo || actividad?.grupo || '');
      setTipo(item.tipo || actividad?.tipo || '');
      setPartidas(item.partidas || actividad?.partidas || '');
      setCap(item.cap || actividad?.cap || '');
      setScap(item.scap || actividad?.scap || '');
      setUnit(item.unit || actividad?.unit || '');
      setComponente(item.componente || actividad?.componente || '');
      setSubcontratista(item.subcontratista || actividad?.subcontratista || 'Propio');
      setProceso(item.proceso || actividad?.proceso || '');
      setUbicacion(item.ubicacion || actividad?.ubicacion || '');
      setResp(item.resp || actividad?.resp || '');
    }
  }, [item, actividad, isOpen]);

  if (!isOpen || !item) return null;

  const activityIdDisplay = item.activityId || actividad?.activityId || item.idOrig || item.id;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(item.id, item.activityId || activityIdDisplay, {
      macro: macro.trim(),
      grupo: grupo.trim(),
      tipo: tipo.trim(),
      partidas: partidas.trim(),
      cap: cap.trim(),
      scap: scap.trim(),
      unit: unit.trim(),
      componente: componente.trim(),
      subcontratista: subcontratista.trim(),
      proceso: proceso.trim(),
      ubicacion: ubicacion.trim(),
      resp: resp.trim()
    });
    onClose();
  };

  return (
    <div
      id="modal-activity-attributes-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        id="modal-activity-attributes-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-white">
                  Atributos de Activity ID
                </h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-indigo-500/30 text-indigo-200 border border-indigo-400/40 font-bold">
                  {activityIdDisplay}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md mt-0.5" title={item.descripcion}>
                {item.wbs ? `${item.wbs} • ` : ''}{item.descripcion}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5 text-blue-900">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="text-[11.5px] leading-relaxed">
              Modifica los atributos del Activity ID para reclasificar esta partida en las vistas jerárquicas (WBS, Fases: Componente, Tipo, Subcontratista, Scap, Unit). Los cambios se sincronizan en el Master CDO y en el plan del proyecto.
            </p>
          </div>

          {/* Primary Hierarchy Attributes (Macro, Grupo, Tipo, Partidas, CAP, SCAP) */}
          <div className="space-y-4">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>Clasificación y Jerarquía Principal</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Macro */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Macro
                </label>
                <input
                  type="text"
                  list="macro-options"
                  value={macro}
                  onChange={e => setMacro(e.target.value)}
                  placeholder="ej. OBRAS CIVILES, SISTEMAS..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="macro-options">
                  {availableOptions.macros.map(m => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                {availableOptions.macros.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                    {availableOptions.macros.slice(0, 4).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMacro(m)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          macro === m
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Grupo */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Grupo
                </label>
                <input
                  type="text"
                  list="grupo-options"
                  value={grupo}
                  onChange={e => setGrupo(e.target.value)}
                  placeholder="ej. GRUPO 1, EQUIPAMIENTO..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="grupo-options">
                  {availableOptions.grupos.map(g => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
                {availableOptions.grupos.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                    {availableOptions.grupos.slice(0, 4).map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGrupo(g)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          grupo === g
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tipo */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Tipo
                </label>
                <input
                  type="text"
                  list="tipo-options"
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  placeholder="ej. MONTAJE, SUMINISTRO, CIVIL..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="tipo-options">
                  {availableOptions.tipos.map(t => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {availableOptions.tipos.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                    {availableOptions.tipos.slice(0, 5).map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTipo(t)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          tipo === t
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Partidas */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Partidas (Clasificación)
                </label>
                <input
                  type="text"
                  list="partidas-options"
                  value={partidas}
                  onChange={e => setPartidas(e.target.value)}
                  placeholder="ej. MOVIMIENTO DE TIERRAS, ESTRUCTURA..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="partidas-options">
                  {availableOptions.partidas.map(p => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </div>

              {/* CAP */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  CAP (Capítulo)
                </label>
                <input
                  type="text"
                  list="cap-options"
                  value={cap}
                  onChange={e => setCap(e.target.value)}
                  placeholder="ej. 01, 17, OBRAS CIVILES..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="cap-options">
                  {availableOptions.caps.map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              {/* SCAP */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  SCAP (Subcapítulo)
                </label>
                <input
                  type="text"
                  list="scap-options"
                  value={scap}
                  onChange={e => setScap(e.target.value)}
                  placeholder="ej. 01.01, 17.02, SUB-01..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="scap-options">
                  {availableOptions.scaps.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Unit / Frente de Obra */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 flex items-center justify-between">
                  <span>Unit / Frente de Obra</span>
                  <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">Atributo Clave</span>
                </label>
                <input
                  type="text"
                  list="unit-options"
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="ej. General, Frente 1, Unit A..."
                  className="w-full bg-teal-50/40 border border-teal-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-all"
                />
                <datalist id="unit-options">
                  {availableOptions.units.map(u => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
                {availableOptions.units.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                    {availableOptions.units.slice(0, 4).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setUnit(u)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          unit === u
                            ? 'bg-teal-600 text-white border-teal-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Componente */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700 flex items-center justify-between">
                  <span>Componente</span>
                  <span className="text-[10px] text-cyan-700 font-bold bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200">Atributo Clave</span>
                </label>
                <input
                  type="text"
                  list="componente-options"
                  value={componente}
                  onChange={e => setComponente(e.target.value)}
                  placeholder="ej. Fundaciones, Tuberías, Equipos..."
                  className="w-full bg-cyan-50/40 border border-cyan-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 transition-all"
                />
                <datalist id="componente-options">
                  {(availableOptions.componentes || []).map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {availableOptions.componentes && availableOptions.componentes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                    {availableOptions.componentes.slice(0, 4).map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setComponente(c)}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                          componente === c
                            ? 'bg-cyan-600 text-white border-cyan-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Collapsible toggle for secondary fields */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-indigo-600 hover:text-indigo-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Ocultar campos secundarios' : 'Ver campos adicionales (Subcontratista, Proceso, Ubicación, Responsable)'}</span>
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 animate-in fade-in">
              {/* Subcontratista */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Subcontratista
                </label>
                <input
                  type="text"
                  list="subc-options"
                  value={subcontratista}
                  onChange={e => setSubcontratista(e.target.value)}
                  placeholder="ej. Propio, Contratista A..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
                <datalist id="subc-options">
                  {availableOptions.subcs.map(s => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>

              {/* Proceso */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Proceso
                </label>
                <input
                  type="text"
                  value={proceso}
                  onChange={e => setProceso(e.target.value)}
                  placeholder="ej. Estructuras, Acabados..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Ubicación */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Ubicación
                </label>
                <input
                  type="text"
                  value={ubicacion}
                  onChange={e => setUbicacion(e.target.value)}
                  placeholder="ej. Sector A, Nivel 2..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Responsable */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="block font-bold text-slate-700">
                  Responsable
                </label>
                <input
                  type="text"
                  value={resp}
                  onChange={e => setResp(e.target.value)}
                  placeholder="ej. Ing. Residente, Supervisor..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
