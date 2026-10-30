const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const regex = /return getVisibleHierarchyNodes\(nodeMap, rootKeys, expandedKeys, filterSubc, filterAvance, searchTerm\);\s*\}, \[filteredNodes, expandedKeys, searchTerm, matchedLeaves\]\);/g;

content = content.replace(regex, `return getVisibleHierarchyNodes(nodeMap, rootKeys, expandedKeys, filterSubc, filterAvance, searchTerm);\n  }, [nodeMap, rootKeys, expandedKeys, filterSubc, filterAvance, searchTerm]);`);

fs.writeFileSync('src/components/MasterTab.tsx', content);
