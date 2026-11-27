const fs = require('fs');

// 1. Fix schema.ts
let schemaContent = fs.readFileSync('src/db/schema.ts', 'utf-8');
const insertPos = schemaContent.lastIndexOf('});');
schemaContent = schemaContent.slice(0, insertPos) + 
  `  cantidadesSemanales: jsonb("cantidades_semanales").default('{}'),
  ventasSemanales: jsonb("ventas_semanales").default('{}'),
` + schemaContent.slice(insertPos);
fs.writeFileSync('src/db/schema.ts', schemaContent);

// 2. Fix MasterTab.tsx
let tabContent = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');
tabContent = tabContent.replace(/cloudData\.meta/g, 'cloudData.planDoc');
fs.writeFileSync('src/components/MasterTab.tsx', tabContent);
