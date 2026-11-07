const fs = require('fs');
const content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');
const lines = content.split('\n');

let openTags = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Very simplistic check, won't handle all JSX properly but can give a hint
}
