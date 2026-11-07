const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

content = content.replace(
  'tsvRows.push(["Semana", "WBS / Nivel", "Activity ID", "Descripción", "BL Finish", "V. Contrato", "V. Plan (PG-004)", "V. Ejecutada (CDO V-)", "Variación", "% Avance"].join("\\t"));',
  'tsvRows.push(["Semana", "WBS / Nivel", "Activity ID", "Descripción", "BL Finish", "V. Contrato", "V. Plan (PG-004)", "V. Ejecutada (CDO V-)", "Variación", "% Avance", "Check Set"].join("\\t"));'
);

content = content.replace(
  /fontWeight: string = 'bold',\s*fontSize: string = '11px',\s*indentCount: number = 0\s*\) => {/,
  'fontWeight: string = \'bold\',\n      fontSize: string = \'11px\',\n      indentCount: number = 0,\n      checkSetText: string = \'\'\n    ) => {'
);

content = content.replace(
  /        fmtMoney\(desv\),\s*pctStr\s*\]\.join\("\\t"\)\);/,
  '        fmtMoney(desv),\n        pctStr,\n        checkSetText\n      ].join("\\t"));'
);

content = content.replace(
  /<td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: \$\{bg\}; color: \$\{fg\}; font-weight: \$\{fontWeight\}; mso-number-format: '0.00%';">\$\{pctStr\}<\/td>\s*<\/tr>/,
  '<td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace, Consolas, sans-serif; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight}; mso-number-format: \'0.00%\';">${pctStr}</td>\n          <td style="padding: 6px 10px; border: 1px solid #cbd5e1; text-align: center; background-color: ${bg}; color: ${fg}; font-weight: ${fontWeight};">${checkSetText}</td>\n        </tr>'
);

content = content.replace(
  /\/\/ N1: Tipo\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet(allItemsInTipo).text);")
);

content = content.replace(
  /\/\/ N2: Grupo\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet(allG).text);")
);

content = content.replace(
  /\/\/ N3: Cap\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet(allCap).text);")
);

content = content.replace(
  /\/\/ N4: SCap\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet(allS).text);")
);

content = content.replace(
  /\/\/ N5: SubC\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet(items).text);")
);

content = content.replace(
  /\/\/ N6: Items\s*items.map\(\(item: any\) => \{[\s\S]*?addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet([item]).text);")
);


fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
