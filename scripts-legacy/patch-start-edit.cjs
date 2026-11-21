const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const regex = /setEditValue\(currentVal === 0 \? '' : String\(currentVal\)\);/;
const replace = `setEditValue(currentVal === 0 ? '' : (currentVal == null ? '' : String(currentVal)));`;
content = content.replace(regex, replace);

fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
