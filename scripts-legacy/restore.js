const fs = require('fs');
const oldContent = `  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (loadCdoMenuRef.current && !loadCdoMenuRef.current.contains(e.target as Node)) {
        setIsLoadCdoMenuOpen(false);
      }
    };
    if (isLoadCdoMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isLoadCdoMenuOpen]);

  // 1. Initial Load: Respects local drafts and cloud with quota-aware error handling
  useEffect(() => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    let isMounted = true;

    async function initMasterData() {
      setIsLoading(true);
      setLoadingProgress(15);
      setLoadingMsg('Verificando datos locales y nube...');

      // Load local draft first
      let localDraft: any = null;
      try {
        localDraft = await loadLocalMasterDraft('master_cdo_default');
      } catch (eDraft) {
        console.warn('Error reading local draft:', eDraft);
      }

      // Priority 1: If local draft exists with items, use it immediately
      if (localDraft && localDraft.items && localDraft.items.length > 0) {
        if (!isMounted) return;
        setItems(localDraft.items);
        setSemanas(localDraft.semanas || []);
        setFileName(localDraft.fileName || 'Master_CDO_Online.xlsx');
        setPlanId(localDraft.planId || 'master_cdo_default');
        setHasUnsavedCloudChanges(!localDraft.isSyncedWithCloud);
        setCloudSaveStatus(localDraft.isSyncedWithCloud ? 'synced' : 'pending');
        const timeStr = new Date(localDraft.updatedAt).toLocaleTimeString();
        setLastLocalSavedTime(timeStr);
        if (!localDraft.isSyncedWithCloud) {
          setLocalDraftNotice({
            time: timeStr,
            itemsCount: localDraft.items.length
          });
        }
        setIsLoading(false);

        // Silently check cloud in background without blocking UI
        loadLatestMasterCdoFromFirebase(undefined, 25000)
          .then(cloudData => {
            if (isMounted && cloudData) {
              setCloudSnapshot({
                items: cloudData.items,
                semanas: cloudData.meta.semanas || [],
                fileName: cloudData.meta.fileName || 'Master_CDO_Online.xlsx'
              });
              setLastCloudSavedTime(cloudData.meta.updatedAt ? new Date(cloudData.meta.updatedAt).toLocaleTimeString() : 'Hoy');
            }
          })
          .catch(err => {
            if (String(err?.message).includes('QUOTA_EXCEEDED') || err?.code === 'resource-exhausted') {
              if (isMounted) setFirestoreQuotaExceeded(true);
            }
          });
        return;
      }

      // Priority 2: No local draft found in browser, query Firestore Cloud
      try {
        const cloudData = await loadLatestMasterCdoFromFirebase((pct, msg) => {
          if (isMounted) {
            setLoadingProgress(pct);
            setLoadingMsg(msg);
          }
        }, 35000);

        if (!isMounted) return;

        if (cloudData && cloudData.items && cloudData.items.length > 0) {
          setCloudSnapshot({
            items: cloudData.items,
            semanas: cloudData.meta.semanas || [],
            fileName: cloudData.meta.fileName || 'Master_CDO_Online.xlsx'
          });
          setItems(cloudData.items);
          setSemanas(cloudData.meta.semanas || []);
          setFileName(cloudData.meta.fileName || 'Master_CDO_Online.xlsx');
          setPlanId(cloudData.meta.id || 'master_cdo_default');
          setHasUnsavedCloudChanges(false);
          setCloudSaveStatus('synced');
          setLastLocalSavedTime(new Date().toLocaleTimeString());
          setLastCloudSavedTime(cloudData.meta.updatedAt ? new Date(cloudData.meta.updatedAt).toLocaleTimeString() : 'Hoy');
          saveLocalMasterDraft(cloudData.meta.id || 'master_cdo_default', cloudData.meta.fileName || 'Master_CDO_Online.xlsx', cloudData.items, cloudData.meta.semanas || [], true);
          setIsLoading(false);
          return;
        }
      } catch (err: any) {
        console.warn('Error cargando Master CDO desde Firestore:', err);
        const isQuota = String(err?.message).includes('QUOTA_EXCEEDED') ||
                        err?.code === 'resource-exhausted' ||
                        String(err?.message).toLowerCase().includes('quota');
        if (isQuota && isMounted) {
          setFirestoreQuotaExceeded(true);
        }
      }

      // Priority 3: Fallback when no draft or cloud data is available
      if (!isMounted) return;
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
        setItems([]);
      }
      setIsLoading(false);
    }

    initMasterData();

    return () => {
      isMounted = false;
    };
  }, [actividades, mapaColumnasMes]);

  // Focus on input when editing cell starts
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Protection: alert before leaving the tab if there are unsaved cloud changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedCloudChanges) {
        e.preventDefault();
        e.returnValue = 'Tienes cambios de avance pendientes de guardar en la nube. ¿Seguro que deseas salir?';
        return 'Tienes cambios de avance pendientes de guardar en la nube. ¿Seguro que deseas salir?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedCloudChanges]);

  // Trigger local data update (Cloud auto-save is DISABLED; saves locally immediately)
  const triggerDataChange = (updatedItems: MasterCdoItem[], updatedSemanas: MasterCdoWeek[]) => {
    setHasUnsavedCloudChanges(true);
    setCloudSaveStatus('pending');

    // Debounced save to local storage/IndexedDB (200ms) to ensure continuous local persistence
    if (localSaveTimeoutRef.current) {
      clearTimeout(localSaveTimeoutRef.current);
    }
    localSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveLocalMasterDraft(planId, fileName, updatedItems, updatedSemanas, false);
        setLastLocalSavedTime(new Date().toLocaleTimeString());
      } catch (err) {
        console.warn('Error al guardar borrador local:', err);
      }
    }, 200);
  };

  // Explicit Manual Local Save
  const handleManualLocalSave = async () => {
    try {
      await saveLocalMasterDraft(planId, fileName, items, semanas, !hasUnsavedCloudChanges);
      const timeStr = new Date().toLocaleTimeString();
      setLastLocalSavedTime(timeStr);
      setToastMessage({
        type: 'success',
        text: \`Borrador guardado localmente (\${timeStr}). Tus avances están protegidos en este navegador.\`
      });
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Error guardando borrador localmente:', err);
      alert(\`Error al guardar localmente: \${err.message || err}\`);
    }
  };

  // Explicit Save to Cloud (Triggered ONLY when user finishes giving progress)
  const saveToCloud = async (
    itemsToSave: MasterCdoItem[] = items,
    semanasToSave: MasterCdoWeek[] = semanas
  ) => {
    if (isSavingCloud || itemsToSave.length === 0) return;
    setIsSavingCloud(true);
    setCloudSaveStatus('saving');
    setCloudErrorMsg('');

    try {
      const currentId = planId || 'master_cdo_default';
      await saveMasterCdoToFirebase(
        currentId,
        fileName,
        itemsToSave,
        semanasToSave,
        userName
      );
      const timeStr = new Date().toLocaleTimeString();
      setHasUnsavedCloudChanges(false);
      setCloudSaveStatus('synced');
      setLastCloudSavedTime(timeStr);
      setLocalDraftNotice(null);

      // Mark local draft as synchronized
      await saveLocalMasterDraft(currentId, fileName, itemsToSave, semanasToSave, true);
      setLastLocalSavedTime(timeStr);

      setToastMessage({
        type: 'success',
        text: \`Sincronización en la nube exitosa (\${timeStr})\`
      });
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err: any) {
      console.error('Error guardando en Firestore:', err);
      setCloudSaveStatus('error');
      
      const isQuota = String(err?.message).includes('QUOTA_EXCEEDED') ||
                      err?.code === 'resource-exhausted' ||
                      String(err?.message).toLowerCase().includes('quota');
                      
      if (isQuota) {
        setFirestoreQuotaExceeded(true);
        setCloudErrorMsg('Cuota diaria de base de datos agotada.');
        alert('Se ha alcanzado el límite gratuito de lecturas/escrituras en la base de datos hoy. Se ha guardado una copia local de seguridad. Podrás sincronizar a la nube mañana cuando se reinicie la cuota.');
      } else {
        setCloudErrorMsg(err.message || 'Error desconocido al guardar en la nube.');
        alert(\`Error guardando en la nube: \${err.message || err}\n\nLos cambios permanecen guardados localmente en este navegador.\`);
      }
    } finally {
      setIsSavingCloud(false);
    }
  };

  const handleExportExcel = () => {
    exportMasterCdoToExcel(items, semanas, fileName);
  };

  const handleUpdateItemQuantityFromXls = (itemId: string, weekId: string, qty: number) => {
    const existingVal = items.find(i => i.id === itemId)?.semanas[weekId]?.qty || 0;
    if (existingVal === qty) return;
    
    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          semanas: {
            ...item.semanas,
            [weekId]: {
              ...item.semanas[weekId],
              qty
            }
          }
        };
      });
      triggerDataChange(newItems, semanas);
      return newItems;
    });
  };

  const handleUpdateItemPropertyFromXls = (itemId: string, field: 'precio' | 'step' | 'cantPres', val: number) => {
    const existingVal = items.find(i => i.id === itemId)?.[field] || 0;
    if (existingVal === val) return;

    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          [field]: val
        };
      });
      triggerDataChange(newItems, semanas);
      return newItems;
    });
  };

  const handleAddWeekSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeekDate) return;
    
    const weekId = newWeekDate;
    
    if (semanas.some(s => s.id === weekId)) {
      alert('Ya existe una semana con esa fecha.');
      return;
    }
    
    let finalLabel = newWeekLabel;
    if (!finalLabel) {
      const [y, m, d] = newWeekDate.split('-');
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      finalLabel = \`Sem \${d}-\${months[parseInt(m)-1]}\`;
    }
    
    const newWeek: MasterCdoWeek = {
      id: weekId,
      fecha: newWeekDate,
      label: finalLabel
    };
    
    const newSemanas = [...semanas, newWeek].sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    setSemanas(newSemanas);
    triggerDataChange(items, newSemanas);
    setShowAddWeekModal(false);
    setNewWeekDate('');
    setNewWeekLabel('');
    setToastMessage({
      type: 'success',
      text: \`Nueva semana agregada: \${finalLabel}\`
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRemoveWeek = (weekId: string, label: string) => {
    if (!window.confirm(\`¿Seguro que deseas eliminar la semana "\${label}"? Se perderán los avances ingresados en esta columna.\`)) {
      return;
    }
    
    const newSemanas = semanas.filter(s => s.id !== weekId);
    
    // Also remove from items
    const newItems = items.map(item => {
      const { [weekId]: removed, ...restSemanas } = item.semanas;
      return {
        ...item,
        semanas: restSemanas
      };
    });
    
    setSemanas(newSemanas);
    setItems(newItems);
    triggerDataChange(newItems, newSemanas);
    setToastMessage({
      type: 'success',
      text: \`Semana \${label} eliminada correctamente.\`
    });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveActivityAttributes = (itemId: string, activityId: string, updates: Partial<Actividad>) => {
    // Call the parent update function to sync globally
    if (onUpdateActividad) {
      onUpdateActividad(activityId, updates);
    }
    
    // Also update local master CDO item
    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            ...updates
          };
        }
        return item;
      });
      triggerDataChange(newItems, semanas);
      return newItems;
    });
  };

  const handleHierarchyLevelChange = (lvl: string) => {
    setHierarchyLevel(lvl);
    if (lvl === 'all') {
      expandAllNodes();
    } else {
      const targetDepth = parseInt(lvl, 10);
      const newExpanded = new Set<string>();
      
      const traverse = (nList: MasterHierarchyNode[], currentDepth: number) => {
        if (currentDepth < targetDepth) {
          nList.forEach(n => {
            if (n.children && n.children.length > 0) {
              newExpanded.add(n.key);
              traverse(n.children, currentDepth + 1);
            }
          });
        }
      };
      traverse(nodes, 1);
      setExpandedKeys(newExpanded);
    }
  };

  // Prepare UI data
  const availableYears = useMemo(() => getAvailableWeekYears(semanas), [semanas]);
  const latestYear = availableYears[availableYears.length - 1] || '';
  
  // Set default selected year to latest if not set or available
  useEffect(() => {
    if (selectedYear !== 'all' && (!selectedYear || selectedYear === 'latest' || !availableYears.includes(selectedYear)) && availableYears.length > 0) {
      setSelectedYear(latestYear);
    }
  }, [availableYears, latestYear, selectedYear]);

  const displayedWeeks = useMemo(() => {
    if (selectedYear === 'all') return semanas;
    const yearToUse = selectedYear === 'latest' ? latestYear : selectedYear;
    return semanas.filter(s => extractWeekYear(s) === yearToUse);
  }, [semanas, selectedYear, latestYear]);

  const tableSummaryTotals = useMemo(() => {
    return calculateMasterTableSummary(items, semanas);
  }, [items, semanas]);

  const totales = useMemo(() => calculateMasterTotals(items), [items]);

  // Derived filtered nodes based on active filters
  const { filteredNodes, matchedLeaves } = useMemo(() => {
    let currentLeaves = getMatchingLeafNodes(nodes, items, searchTerm);
    
    // 1. Filter by Subcontractor
    if (filterSubc !== 'all') {
      currentLeaves = currentLeaves.filter(node => {
        const item = items.find(i => i.id === node.itemId);
        return item?.subcontratista === filterSubc;
      });
    }

    // 2. Filter by Avance status
    if (filterAvance !== 'all') {
      currentLeaves = currentLeaves.filter(node => {
        const item = items.find(i => i.id === node.itemId);
        if (!item) return false;
        
        let hasAnyAvance = false;
        let qtyAvance = 0;
        
        Object.values(item.semanas).forEach(sem => {
          if (sem.qty > 0) hasAnyAvance = true;
          qtyAvance += sem.qty;
        });

        if (filterAvance === 'con_avance') {
          return hasAnyAvance;
        } else if (filterAvance === 'sin_avance') {
          return !hasAnyAvance;
        } else if (filterAvance === 'saldo_pendiente') {
          return item.cantPres > qtyAvance;
        }
        return true;
      });
    }

    return { 
      filteredNodes: nodes,
      matchedLeaves: currentLeaves 
    };
  }, [nodes, items, searchTerm, filterSubc, filterAvance]);

  const visibleNodes = useMemo(() => {
    return getVisibleHierarchyNodes(filteredNodes, expandedKeys, searchTerm ? matchedLeaves : undefined);
  }, [filteredNodes, expandedKeys, searchTerm, matchedLeaves]);

  // Handle loading states
  if (isLoading) {
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
  }

  // Handle Quota Exceeded Block
  if (firestoreQuotaExceeded && (!items || items.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[500px] bg-slate-50 rounded-3xl border border-red-200 p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-red-500 mb-4" />
        <h3 className="text-xl font-black text-slate-900 mb-2">Límite de Base de Datos Alcanzado</h3>
        <p className="text-sm font-medium text-slate-600 max-w-lg mb-6">
          Se ha agotado el límite gratuito diario de operaciones en Firestore.
          No se pudieron cargar los datos del proyecto.
        </p>
        <p className="text-xs text-slate-500 max-w-md bg-white p-4 rounded-xl border border-slate-200">
          La cuota se reinicia automáticamente en 24 horas. Para seguir trabajando, debes esperar o cargar un archivo Excel local.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full bg-slate-50 flex flex-col relative w-full overflow-hidden">
      {/* 4. MODAL: AGREGAR NUEVA SEMANA */}
      {showAddWeekModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[99] animate-fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Agregar Nueva Semana de Avance</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Crea una nueva columna de corte semanal en el Master CDO.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWeekModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddWeekSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Fecha de Corte Semanal (ISO):
                </label>
                <input
                  type="date"
                  value={newWeekDate}
                  onChange={e => setNewWeekDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Etiqueta de la Columna (opcional):
                </label>
                <input
                  type="text"
                  value={newWeekLabel}
                  onChange={e => setNewWeekLabel(e.target.value)}
                  placeholder="Ej. Sem 06-Mar-2026"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Si se deja vacío, se nombrará automáticamente a partir de la fecha seleccionada.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddWeekModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
                >
                  Confirmar y Agregar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. MODAL: EDITAR ATRIBUTOS DEL ACTIVITY ID */}
      <ActivityAttributesModal
        isOpen={!!editingActivityAttributes}
        onClose={() => setEditingActivityAttributes(null)}
        item={editingActivityAttributes?.item || null}
        actividad={
          editingActivityAttributes
            ? actividades.find(
                a =>
                  (a.activityId && a.activityId === editingActivityAttributes.activityId) ||
                  a.id === editingActivityAttributes.activityId ||
                  (a.idOrig && a.idOrig === editingActivityAttributes.activityId)
              )
            : null
        }
        availableOptions={availableAttributeOptions}
        onSave={(itemId, activityId, updates) => {
          handleSaveActivityAttributes(itemId, activityId, updates);
          setToastMessage({
            type: 'success',
            text: \`Atributos actualizados para \${activityId || 'la partida'}.\`
          });
          setTimeout(() => setToastMessage(null), 4000);
        }}
      />

      {/* 6. VISTA MAXIMIZADA HOJA EXCEL */}
      <MasterXlsSheetView
        isOpen={true}
        onBack={onBack}
        nodes={visibleNodes}
        nodeMap={nodeMap}
        rootKeys={rootKeys}
        semanas={semanas}
        items={items}
        actividades={actividades}
        totals={totales}
        viewMode={viewMode}
        setViewMode={setViewMode}
        hierarchyMode={hierarchyMode}
        setHierarchyMode={setHierarchyMode}
        hierarchyLevel={hierarchyLevel}
        onHierarchyLevelChange={handleHierarchyLevelChange}
        expandedKeys={expandedKeys}
        toggleNodeExpand={toggleNodeExpand}
        expandAllNodes={expandAllNodes}
        collapseAllNodes={collapseAllNodes}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterSubc={filterSubc}
        setFilterSubc={setFilterSubc}
        subcontratistasList={subcontratistasList}
        filterAvance={filterAvance}
        setFilterAvance={setFilterAvance}
        onOpenAttributesModal={(item, activityId) => {
          setEditingActivityAttributes({ item, activityId });
        }}
        onAddWeek={() => setShowAddWeekModal(true)}
        onRemoveWeek={handleRemoveWeek}
        onSaveCloud={() => saveToCloud()}
        isSavingCloud={isSavingCloud}
        hasUnsavedCloudChanges={hasUnsavedCloudChanges}
        onExportExcel={handleExportExcel}
        onUpdateItemQuantity={handleUpdateItemQuantityFromXls}
        onUpdateItemProperty={handleUpdateItemPropertyFromXls}
        availableYears={availableYears}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        latestYear={latestYear}
        displayedWeeks={displayedWeeks}
        showAttributeCols={showAttributeCols}
        setShowAttributeCols={setShowAttributeCols}
        tableSummaryTotals={tableSummaryTotals}
        onOpenWbsEditor={() => setIsWbsEditorOpen(true)}
        onSaveLocal={() => {
          saveToLocalDraft(items, semanas);
          setToastMessage({ type: 'success', text: 'Guardado localmente como borrador.' });
        }}
      />

      <WbsHierarchyEditor
        isOpen={isWbsEditorOpen}
        onClose={() => setIsWbsEditorOpen(false)}
        actividades={actividades}
        onUpdateActividad={onUpdateActividad}
        onAddActividad={onAddActividad}
        onDeleteActividad={onDeleteActividad}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[100] animate-bounce-in">
          <div
            className={\`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold text-white \${
              toastMessage.type === 'success'
                ? 'bg-slate-900/95 border-emerald-500/50 shadow-emerald-950/20'
                : 'bg-slate-900/95 border-blue-500/50 shadow-blue-950/20'
            }\`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-blue-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('src/components/MasterTab.tsx', content.substring(0, startIdx) + oldContent);

