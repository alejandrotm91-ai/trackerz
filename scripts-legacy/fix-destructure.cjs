const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

content = content.replace(
  "onExportExcel,",
  "onExportExcel,\n  onLoadExcel,"
);

fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
