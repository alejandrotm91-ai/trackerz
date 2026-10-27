const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const regex = /\/\/ 1\. Filter by Subcontractor[\s\S]*?return \{\s*filteredNodes:\s*nodes,\s*matchedLeaves:\s*currentLeaves\s*\};/g;

content = content.replace(regex, `return { filteredNodes: nodes, matchedLeaves: currentLeaves };`);

fs.writeFileSync('src/components/MasterTab.tsx', content);
