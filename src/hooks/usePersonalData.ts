/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { PersonalRegistro } from '../types/personal';
import {
  clasificarTipoPersonal,
  cleanEmpresaName,
  standardizeFrente,
  standardizeActividad
} from '../utils/personalParser';
import { getInitialPersonalData } from '../data/samplePersonalData';
import { loadLatestPersonalPlanFromFirebase } from '../utils/firebaseSync';

export function usePersonalData() {
  const [registros, setRegistros] = useState<PersonalRegistro[]>([]);
  const [currentFileName, setCurrentFileName] = useState<string>('');
  const [isCloudLoaded, setIsCloudLoaded] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setIsLoading(true);
      try {
        const cloudData = await loadLatestPersonalPlanFromFirebase();
        if (!isMounted) return;

        if (cloudData && cloudData.registros && cloudData.registros.length > 0) {
          const hydrated = cloudData.registros.map(r => ({
            ...r,
            fechaDate: r.fechaIso ? new Date(`${r.fechaIso}T00:00:00`) : undefined
          }));
          setRegistros(hydrated);
          setCurrentFileName(cloudData.planMeta?.fileName || 'Matriz_Personal_Nube.xlsx');
          setIsCloudLoaded(true);
        } else {
          const initial = getInitialPersonalData();
          setRegistros(initial);
          setCurrentFileName('Datos_Demostracion.xlsx');
          setIsCloudLoaded(false);
        }
      } catch (err) {
        console.warn('Could not load remote personal plan, fallback to demo:', err);
        if (isMounted) {
          const initial = getInitialPersonalData();
          setRegistros(initial);
          setCurrentFileName('Datos_Demostracion.xlsx');
          setIsCloudLoaded(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const normalizedRegistros = useMemo(() => {
    return registros.map(r => {
      const empresaEstandarizada = cleanEmpresaName(r.empresa);
      const frenteEstandarizado = standardizeFrente(r.frente);
      const actividadEstandarizada = standardizeActividad(r.actividad);
      const tipoCalculado = clasificarTipoPersonal(frenteEstandarizado, empresaEstandarizada, actividadEstandarizada);
      if (
        r.empresa !== empresaEstandarizada ||
        r.frente !== frenteEstandarizado ||
        r.actividad !== actividadEstandarizada ||
        r.tipo !== tipoCalculado
      ) {
        return {
          ...r,
          empresa: empresaEstandarizada,
          frente: frenteEstandarizado,
          actividad: actividadEstandarizada,
          tipo: tipoCalculado
        };
      }
      return r;
    });
  }, [registros]);

  const availableMeses: [string, string][] = useMemo(() => {
    const map = new Map<string, string>();
    normalizedRegistros.forEach(r => {
      if (r.mesKey && r.mesLabel) map.set(r.mesKey, r.mesLabel);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [normalizedRegistros]);

  const availableSemanas: [string, string][] = useMemo(() => {
    const map = new Map<string, string>();
    normalizedRegistros.forEach(r => {
      if (r.semanaKey && r.semanaLabel) map.set(r.semanaKey, r.semanaLabel);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [normalizedRegistros]);

  return {
    registros,
    setRegistros,
    normalizedRegistros,
    availableMeses,
    availableSemanas,
    currentFileName,
    setCurrentFileName,
    isCloudLoaded,
    setIsCloudLoaded,
    isLoading
  };
}
