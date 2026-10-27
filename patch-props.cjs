const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const regex = /onUpdateItemProperty: \(itemId: string, field: 'precio' \| 'step' \| 'cantPres', val: number\) => void;/;
const replacement = `onUpdateItemProperty: (itemId: string, field: 'precio' | 'step' | 'cantPres', val: number) => void;
  onUpdateItemStringProperty?: (itemId: string, field: string, val: string) => void;`;

content = content.replace(regex, replacement);

const regexProps = /onUpdateItemProperty,\n  availableYears/;
const replaceProps = `onUpdateItemProperty,\n  onUpdateItemStringProperty,\n  availableYears`;

content = content.replace(regexProps, replaceProps);

fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
