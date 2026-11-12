const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

content = content.replace(/ubicaciones: \[\],\n          resps: \[\]/g, 'subcs: []');

fs.writeFileSync('src/components/MasterTab.tsx', content);
