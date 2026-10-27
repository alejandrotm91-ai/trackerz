const fs = require('fs');
let schemaContent = fs.readFileSync('src/db/schema.ts', 'utf-8');

schemaContent = schemaContent.replace(/  cantidadesSemanales: jsonb\("cantidades_semanales"\)\.default\('\{\}'\),\n  ventasSemanales: jsonb\("ventas_semanales"\)\.default\('\{\}'\),\n/g, '');

const insertPos = schemaContent.indexOf('});', schemaContent.indexOf('export const masterItems ='));
schemaContent = schemaContent.slice(0, insertPos) + 
  `  cantidadesSemanales: jsonb("cantidades_semanales").default('{}'),
  ventasSemanales: jsonb("ventas_semanales").default('{}'),
` + schemaContent.slice(insertPos);

fs.writeFileSync('src/db/schema.ts', schemaContent);
