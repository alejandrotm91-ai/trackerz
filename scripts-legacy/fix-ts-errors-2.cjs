const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

// Fix getMatchingLeafNodes
content = content.replace(
  `let currentLeaves = getMatchingLeafNodes(nodes, searchTerm);`,
  `let currentLeaves = getMatchingLeafNodes(nodeMap, rootKeys, filterSubc, filterAvance, searchTerm);`
);

// Fix visible nodes
content = content.replace(
  `    return getVisibleHierarchyNodes(filteredNodes, expandedKeys, searchTerm ? matchedLeaves : undefined);`,
  `    return getVisibleHierarchyNodes(nodeMap, rootKeys, expandedKeys, currentLeaves);`
);

// Fix saveToLocalDraft undefined
content = content.replace(
  `await saveToLocalDraft(currentId, fileName, itemsToSave, semanasToSave, false);`,
  `await saveToLocalDraft(itemsToSave, semanasToSave);`
);

// Fix availableAttributeOptions undefined in MasterTab.tsx 821
const removeAttrOptionsRegex = /availableAttributeOptions=\{availableAttributeOptions\}/;
content = content.replace(removeAttrOptionsRegex, "");

fs.writeFileSync('src/components/MasterTab.tsx', content);
console.log("Done fixing TS 2");
