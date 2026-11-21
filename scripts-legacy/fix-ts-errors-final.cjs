const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

// 1. Fix nodes being MasterCdoItem[] instead of MasterHierarchyNode[]
// Replace the earlier useMemo flat nodes definition with just using `nodes` properly
// Look for where we created nodes and fix it:
// `const nodes = useMemo(() => Array.from(nodeMap.values()), [nodeMap]);`
// But we actually destructured `nodes` from buildMasterHierarchyTree in the original code, but then changed it in fix 1.
// Let's restore the original destructuring if buildMasterHierarchyTree returns nodes
const getMatchingLeafNodesRegex = /const currentLeaves = getMatchingLeafNodes\(nodeMap, rootKeys, filterSubc, filterAvance, searchTerm\);/;
content = content.replace(getMatchingLeafNodesRegex, `let currentLeaves = getMatchingLeafNodes(nodeMap, rootKeys, filterSubc, filterAvance, searchTerm);`);

// Fix currentLeaves constant assignment errors
// We changed it to `const` but it needs to be `let` because it is reassigned
// already handled above

// Fix getVisibleHierarchyNodes signature
const visibleNodesFix = /return getVisibleHierarchyNodes\(nodes, expandedKeys, searchTerm \? currentLeaves : undefined\);/;
content = content.replace(visibleNodesFix, `return getVisibleHierarchyNodes(nodes, expandedKeys, searchTerm ? matchedLeaves : undefined);`);
const visibleNodesFix2 = /return getVisibleHierarchyNodes\(nodeMap, rootKeys, expandedKeys, currentLeaves\);/;
content = content.replace(visibleNodesFix2, `return getVisibleHierarchyNodes(nodes, expandedKeys, searchTerm ? matchedLeaves : undefined);`);


// Fix availableAttributeOptions
content = content.replace(/availableAttributeOptions=\{availableAttributeOptions\}/g, "");

// Fix saveToLocalDraft
content = content.replace(/await saveToLocalDraft\([^)]*\);/g, `await saveLocalMasterDraft(planId || 'master_cdo_default', fileName, itemsToSave, semanasToSave, false);`);

fs.writeFileSync('src/components/MasterTab.tsx', content);
console.log("Done fixing TS final");
