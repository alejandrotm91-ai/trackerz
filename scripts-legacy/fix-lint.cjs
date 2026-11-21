const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');
content = content.replace(/AlertTriangle\n  Loader2/, "AlertTriangle,\n  Loader2");
fs.writeFileSync('src/components/MasterTab.tsx', content);
