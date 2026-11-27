const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const regex = /  \}, \[isOpen, editingCell, activeCell\]\);\n    setEditingCell\(/;
const replace = `  }, [isOpen, editingCell, activeCell]);
  
  const startCellEdit = (
    nodeKey: string,
    itemId: string,
    field: string,
    currentVal: number | string,
    weekId?: string
  ) => {
    setActiveCell({ nodeKey, field, weekId });
    setEditingCell(`;

content = content.replace(regex, replace);
fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
