const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const regex = /\{\/\* 4\.5\. EXCEL PAGINATION & SLICING BAR \*\/\}[\s\S]*?<\/select>\s*<\/div>[\s\S]*?\{\/\* Pagination Controls \*\/\}[\s\S]*?<\/div>\s*\)\}\s*<\/div>\s*<\/div>/;

const match = content.match(regex);
if (match) {
  const newBar = `{/* 4.5. EXCEL SLICING BAR */}
        <div className="bg-slate-50 border-t border-slate-300 px-4 py-1.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none font-sans">
          <div className="flex items-center gap-2 text-slate-600">
            <span className="font-semibold text-slate-800">
              Mostrando {Math.min(renderLimit, filteredNodes.length)} de {filteredNodes.length} filas
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500 font-medium text-[11px]">
              {expandedKeys.size === 0
                ? '⚡ Por defecto todo está colapsado para máxima velocidad. Haz clic en ▶ en cualquier capítulo para desplegar partidas.'
                : \`\${expandedKeys.size} niveles desplegados.\`}
            </span>
          </div>
        </div>`;
  content = content.replace(match[0], newBar);
  fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
  console.log("Success");
} else {
  console.log("Failed to match");
}
