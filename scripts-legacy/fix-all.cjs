const fs = require('fs');

// 1. Fix MasterXlsSheetView.tsx Types
let xlsContent = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const regexEditingCell = /const \[editingCell, setEditingCell\] = useState<\{[\s\S]*?\} \| null>\(null\);/;
const replaceEditingCell = `const [editingCell, setEditingCell] = useState<{
    itemId: string;
    field: string;
    weekId?: string;
    nodeKey: string;
  } | null>(null);`;
xlsContent = xlsContent.replace(regexEditingCell, replaceEditingCell);

const regexActiveCell = /const \[activeCell, setActiveCell\] = useState<\{[\s\S]*?\} \| null>\(null\);/;
const replaceActiveCell = `const [activeCell, setActiveCell] = useState<{
    nodeKey: string;
    field: string;
    weekId?: string;
  } | null>(null);`;
xlsContent = xlsContent.replace(regexActiveCell, replaceActiveCell);

// 2. Fix MasterXlsSheetView.tsx TS errors with \`itemId\` missing from \`activeCell\`
// In \`handlePaste\`, we just need to use \`activeCell.nodeKey\` to find \`itemId\` or just ignore pasting for non-qty since it's hard to find item.
const regexHandlePaste = /const { itemId, field, weekId } = activeCell;/;
xlsContent = xlsContent.replace(regexHandlePaste, 'const { field, weekId } = activeCell;');

fs.writeFileSync('src/components/MasterXlsSheetView.tsx', xlsContent);

// 3. Fix MasterTab.tsx
let tabContent = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');
tabContent = tabContent.replace(/data\.meta/g, 'data.planDoc');
fs.writeFileSync('src/components/MasterTab.tsx', tabContent);

// 4. Fix masterCdo.ts
let dbContent = fs.readFileSync('src/db/masterCdo.ts', 'utf-8');
dbContent = dbContent.replace(/cantidadesSemanales: i\.cantidadesSemanales/g, 'cantidadesSemanales: (i.cantidadesSemanales as Record<string, number>)');
dbContent = dbContent.replace(/ventasSemanales: i\.ventasSemanales/g, 'ventasSemanales: (i.ventasSemanales as Record<string, number>)');
fs.writeFileSync('src/db/masterCdo.ts', dbContent);
