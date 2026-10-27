const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const availableOptionsString = `        availableOptions={{
          macros: [],
          grupos: [],
          tipos: [],
          partidas: [],
          caps: [],
          scaps: [],
          componentes: [],
          units: [],
          ubicaciones: [],
          resps: []
        }}`;

content = content.replace(
  /onSave=\{\(itemId, activityId, updates\) => \{/,
  `${availableOptionsString}\n        onSave={(itemId, activityId, updates) => {`
);

fs.writeFileSync('src/components/MasterTab.tsx', content);
console.log("Fixed modal");
