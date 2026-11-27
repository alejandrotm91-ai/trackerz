const fs = require('fs');
const content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const returnStart = content.indexOf('return (');

if (returnStart !== -1) {
  const replacement = `return (
    <div className="h-full bg-slate-50 flex flex-col relative w-full overflow-hidden">
      {/* 4. MODAL: AGREGAR NUEVA SEMANA */}
      {showAddWeekModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
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
  
  const newContent = content.substring(0, returnStart) + replacement;
  fs.writeFileSync('src/components/MasterTab.tsx', newContent);
}
