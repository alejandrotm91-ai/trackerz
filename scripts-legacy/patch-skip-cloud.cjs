const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

// 1. Add cancelLoadRef
content = content.replace(
  "const hasInitializedRef = useRef<boolean>(false);",
  "const hasInitializedRef = useRef<boolean>(false);\n  const cancelLoadRef = useRef<boolean>(false);"
);

// 2. Add skip button to loading state
const loadingState = `  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50 rounded-3xl border border-slate-200">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700 animate-pulse">{loadingMsg}</p>
        <div className="w-64 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300 ease-out"
            style={{ width: \`\${loadingProgress}%\` }}
          />
        </div>
      </div>
    );
  }`;

const loadingStateWithSkip = `  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50 rounded-3xl border border-slate-200">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-700 animate-pulse">{loadingMsg}</p>
        <div className="w-64 h-2 bg-slate-200 rounded-full mt-4 overflow-hidden">
          <div 
            className="h-full bg-indigo-600 transition-all duration-300 ease-out"
            style={{ width: \`\${loadingProgress}%\` }}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            cancelLoadRef.current = true;
            setIsLoading(false);
            if (!items || items.length === 0) {
              if (actividades && actividades.length > 0) {
                const seed = initializeMasterCdoFromActividades(actividades, mapaColumnasMes);
                setItems(seed.items);
                setSemanas(seed.semanas);
                setFileName('Master_CDO_Proyecto_Actual.xlsx');
                setPlanId('master_cdo_default');
                setHasUnsavedCloudChanges(true);
                setCloudSaveStatus('pending');
              } else {
                setSemanas([
                  { id: '2026-02-06', fecha: '2026-02-06', label: 'Sem 06-Feb' },
                  { id: '2026-02-13', fecha: '2026-02-13', label: 'Sem 13-Feb' },
                  { id: '2026-02-20', fecha: '2026-02-20', label: 'Sem 20-Feb' },
                  { id: '2026-02-27', fecha: '2026-02-27', label: 'Sem 27-Feb' },
                ]);
              }
            }
          }}
          className="mt-6 px-4 py-2 bg-white border border-slate-300 rounded-xl text-slate-700 text-sm font-bold shadow-sm hover:bg-slate-50 transition-colors"
        >
          Ingresar sin cargar de la nube
        </button>
      </div>
    );
  }`;

content = content.replace(loadingState, loadingStateWithSkip);

// 3. Update useEffect logic to respect cancelLoadRef
content = content.replace(
  `        const cloudData = await loadLatestMasterCdoFromFirebase((pct, msg) => {
          if (isMounted) {
            setLoadingProgress(pct);
            setLoadingMsg(msg);
          }
        }, 35000);

        if (!isMounted) return;`,
  `        const cloudData = await loadLatestMasterCdoFromFirebase((pct, msg) => {
          if (isMounted && !cancelLoadRef.current) {
            setLoadingProgress(pct);
            setLoadingMsg(msg);
          }
        }, 35000);

        if (!isMounted || cancelLoadRef.current) return;`
);

// 4. Update Quota Exceeded Block to add "Continuar Offline" button
const quotaState = `  // Handle Quota Exceeded Block
  if (firestoreQuotaExceeded && (!items || items.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50 rounded-3xl border border-red-200 p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-black text-slate-800 mb-2">Límite de Base de Datos Alcanzado</h3>
        <p className="text-slate-600 mb-6 max-w-md text-sm">
          Se ha agotado la cuota gratuita diaria de lecturas en la nube. Por seguridad, no se ha cargado el archivo para evitar pérdida de datos. La cuota se reinicia mañana.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-900 transition-colors"
        >
          Volver a Resumen
        </button>
      </div>
    );
  }`;

const quotaStateWithSkip = `  // Handle Quota Exceeded Block
  if (firestoreQuotaExceeded && (!items || items.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50 rounded-3xl border border-red-200 p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-black text-slate-800 mb-2">Límite de Base de Datos Alcanzado</h3>
        <p className="text-slate-600 mb-6 max-w-md text-sm">
          Se ha agotado la cuota gratuita diaria de lecturas en la nube. Por seguridad, no se ha cargado el archivo para evitar pérdida de datos. La cuota se reinicia mañana.
        </p>
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="px-6 py-2.5 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-900 transition-colors"
          >
            Volver a Resumen
          </button>
          <button
            onClick={() => {
              setFirestoreQuotaExceeded(false);
              cancelLoadRef.current = true;
              if (actividades && actividades.length > 0) {
                const seed = initializeMasterCdoFromActividades(actividades, mapaColumnasMes);
                setItems(seed.items);
                setSemanas(seed.semanas);
                setFileName('Master_CDO_Proyecto_Actual.xlsx');
                setPlanId('master_cdo_default');
                setHasUnsavedCloudChanges(true);
                setCloudSaveStatus('pending');
              }
            }}
            className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
          >
            Continuar de todos modos (Offline)
          </button>
        </div>
      </div>
    );
  }`;

content = content.replace(quotaState, quotaStateWithSkip);

fs.writeFileSync('src/components/MasterTab.tsx', content);
