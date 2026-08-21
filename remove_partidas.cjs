const fs = require('fs');
let content = fs.readFileSync('src/components/CronogramaTab.tsx', 'utf8');

const regex = /\s*\{\/\* Partidas list table \*\/\}\s*\{!tipologiaSeleccionada && !partidaSeleccionada && \(\(\) => \{[\s\S]*?\}\)\(\)\}/;

content = content.replace(regex, '');

fs.writeFileSync('src/components/CronogramaTab.tsx', content);
