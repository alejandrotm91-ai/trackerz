const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const regexType = /field: 'qty' \| 'precio' \| 'step' \| 'cantPres' \| 'view';/g;
const replaceType = `field: 'qty' | 'precio' | 'step' | 'cantPres' | 'view' | string;`;
content = content.replace(regexType, replaceType);

const regexStart = /field: 'qty' \| 'precio' \| 'step' \| 'cantPres',/g;
const replaceStart = `field: string,`;
content = content.replace(regexStart, replaceStart);

const regexVal = /currentVal: number,/g;
const replaceVal = `currentVal: number | string,`;
content = content.replace(regexVal, replaceVal);

const regexCommit = /const cleanNum = parseFloat\(editValue\.replace\(\/\[\$,\]\/g, ''\)\.trim\(\)\) \|\| 0;/;
const replaceCommit = `const isNumberField = ['qty', 'precio', 'step', 'cantPres'].includes(field);
    const cleanNum = isNumberField ? (parseFloat(editValue.replace(/[$,]/g, '').trim()) || 0) : 0;
    
    if (field === 'qty' && weekId) {
      onUpdateItemQuantity(itemId, weekId, cleanNum);
    } else if (['precio', 'step', 'cantPres'].includes(field)) {
      onUpdateItemProperty(itemId, field as any, cleanNum);
    } else if (onUpdateItemStringProperty) {
      onUpdateItemStringProperty(itemId, field, editValue);
    }`;

// Remove old if block for commit
const regexOldCommit = /if \(field === 'qty' && weekId\) \{[\s\S]*?onUpdateItemProperty\(itemId, field, cleanNum\);\n    \}/;
content = content.replace(regexOldCommit, "");
content = content.replace(regexCommit, replaceCommit);

fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
