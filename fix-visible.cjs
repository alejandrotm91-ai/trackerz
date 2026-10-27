const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const visibleNodesRegex = /return getVisibleHierarchyNodes\(nodes, expandedKeys, searchTerm \? matchedLeaves : undefined\);/;
content = content.replace(visibleNodesRegex, `return getVisibleHierarchyNodes(nodeMap, rootKeys, expandedKeys, filterSubc, filterAvance, searchTerm);`);

fs.writeFileSync('src/components/MasterTab.tsx', content);
