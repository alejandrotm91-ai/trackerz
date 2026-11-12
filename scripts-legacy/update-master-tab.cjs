const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const loadFileLogic = `  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsLoading(true);
      setLoadingMsg(\`Procesando archivo \${file.name}...\`);
      const parsedData = await parseMasterCdoFromExcel(file, (pct, msg) => {
        setLoadingProgress(pct);
        setLoadingMsg(msg);
      });
      if (parsedData.items.length > 0) {
        setItems(parsedData.items);
        setSemanas(parsedData.semanas);
        setFileName(file.name);
        setHasUnsavedCloudChanges(true);
        setCloudSaveStatus('pending');
        saveLocalMasterDraft(planId, file.name, parsedData.items, parsedData.semanas, false);
      }
    } catch (err: any) {
      console.error(err);
      alert('Error cargando el archivo: ' + err.message);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 1. Initial Load: Respects local drafts and cloud with quota-aware error handling`;

content = content.replace("  // 1. Initial Load: Respects local drafts and cloud with quota-aware error handling", loadFileLogic);

// Add the hidden file input before the MasterXlsSheetView and the prop
const viewReplacement = `      <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
      {/* 6. VISTA MAXIMIZADA HOJA EXCEL */}
      <MasterXlsSheetView
        isOpen={true}
        onLoadExcel={() => fileInputRef.current?.click()}`;

content = content.replace(`      {/* 6. VISTA MAXIMIZADA HOJA EXCEL */}
      <MasterXlsSheetView
        isOpen={true}`, viewReplacement);

fs.writeFileSync('src/components/MasterTab.tsx', content);
