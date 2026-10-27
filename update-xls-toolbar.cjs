const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

// 1. Add Upload to imports
content = content.replace("Download,", "Download,\n  Upload,");

// 2. Add onLoadExcel to props
content = content.replace("onExportExcel: () => void;", "onExportExcel: () => void;\n  onLoadExcel?: () => void;");

// 3. Update the toolbar buttons
const oldToolbar = `            <button
              type="button"
              onClick={onSaveCloud}
              disabled={isSavingCloud}
              className={\`flex items-center justify-center w-8 h-8 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer border \${
                hasUnsavedCloudChanges
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-900'
              }\`}
              title="Sincronizar con la nube (Firestore)"
            >
              <Cloud className={\`w-4 h-4 \${isSavingCloud ? 'animate-spin' : ''}\`} />
            </button>

            <div className="w-px h-6 bg-emerald-800 mx-1"></div>

            <button
              type="button"
              onClick={onOpenWbsEditor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Editor WBS"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>WBS</span>
            </button>

            <button
              type="button"
              onClick={onExportExcel}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Descargar archivo Excel"
            >
              <Download className="w-4 h-4" />
            </button>

            <button`;

const newToolbar = `            <button
              type="button"
              onClick={onSaveCloud}
              disabled={isSavingCloud}
              className={\`flex items-center justify-center w-8 h-8 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer border \${
                hasUnsavedCloudChanges
                  ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 border-amber-500'
                  : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-900'
              }\`}
              title="Sincronizar con la nube (Firestore)"
            >
              <Cloud className={\`w-4 h-4 \${isSavingCloud ? 'animate-spin' : ''}\`} />
            </button>

            <button
              type="button"
              onClick={onLoadExcel}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Cargar el master"
            >
              <Upload className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onExportExcel}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Descargar archivo Excel"
            >
              <Download className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-emerald-800 mx-1"></div>

            <button
              type="button"
              onClick={onOpenWbsEditor}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Editor WBS"
            >
              <ListTree className="w-3.5 h-3.5" />
              <span>WBS</span>
            </button>

            <button`;

content = content.replace(oldToolbar, newToolbar);
fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
