const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

content = content.replace(
  /\/\/ N5: Subcontratista\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet(items).text);")
);

content = content.replace(
  /\/\/ N6: Leaf items\s*items\.forEach\(\(item: any\) => \{\s*const \{ [^}]+ \} = getItemWeekValues\(item\);\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet([item]).text);")
);

content = content.replace(
  /\/\/ TOTAL PROYECTO ROW\s*addRowHtml\([^;]+\);/g,
  (match) => match.replace(/\);$/, ", getAccumulatedCheckSet(leafItems).text);")
);


fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
