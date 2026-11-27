const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

// Fix 650, 653, 662, 670, 700
const filterSubcRegex = /currentLeaves\.filter\(node => \{\n        const item = items\.find\(i => i\.id === node\.itemId\);\n        return item\?\.subcontratista === filterSubc;\n      \}\)/;
content = content.replace(filterSubcRegex, `currentLeaves.filter(node => node.subcontratista === filterSubc)`);

const filterAvanceRegex = /currentLeaves\.filter\(node => \{\n        const item = items\.find\(i => i\.id === node\.itemId\);\n        if \(!item\) return false;\n        \n        let hasAnyAvance = false;\n        let qtyAvance = 0;\n        \n        Object\.values\(item\.cantidadesSemanales \|\| \{\}\)\.forEach\(qty => \{\n          if \(qty > 0\) hasAnyAvance = true;\n          qtyAvance \+= qty;\n        \}\);\n\n        if \(filterAvance === 'con_avance'\) \{\n          return hasAnyAvance;\n        \} else if \(filterAvance === 'sin_avance'\) \{\n          return !hasAnyAvance;\n        \} else if \(filterAvance === 'saldo_pendiente'\) \{\n          return item\.cantidadPresupuesto > qtyAvance;\n        \}\n        return true;\n      \}\)/;
content = content.replace(filterAvanceRegex, `currentLeaves.filter(node => {
        const item = items.find(i => i.id === node.activityId);
        if (!item) return false;
        
        let hasAnyAvance = false;
        let qtyAvance = 0;
        
        Object.values(item.cantidadesSemanales || {}).forEach(qty => {
          if (qty > 0) hasAnyAvance = true;
          qtyAvance += qty;
        });

        if (filterAvance === 'con_avance') {
          return hasAnyAvance;
        } else if (filterAvance === 'sin_avance') {
          return !hasAnyAvance;
        } else if (filterAvance === 'saldo_pendiente') {
          return item.cantidadPresupuesto > qtyAvance;
        }
        return true;
      })`);


const currentLeavesRegex = /let currentLeaves = getMatchingLeafNodes\(nodeMap, rootKeys, filterSubc, filterAvance, searchTerm\);/;
content = content.replace(currentLeavesRegex, `const currentLeaves = getMatchingLeafNodes(nodeMap, rootKeys, filterSubc, filterAvance, searchTerm);`);


// getVisibleHierarchyNodes call
const visibleNodesRegex = /return getVisibleHierarchyNodes\(nodeMap, rootKeys, expandedKeys, currentLeaves\);/;
content = content.replace(visibleNodesRegex, `return getVisibleHierarchyNodes(nodes, expandedKeys, searchTerm ? currentLeaves : undefined);`);


// Fix availableAttributeOptions undefined in MasterTab.tsx 821
const removeAttrOptionsRegex2 = /availableAttributeOptions=\{availableAttributeOptions\}/;
content = content.replace(removeAttrOptionsRegex2, "");


// Fix saveToLocalDraft
const saveToLocalDraftRegex = /await saveToLocalDraft\(itemsToSave, semanasToSave\);/;
content = content.replace(saveToLocalDraftRegex, `
      const currentId = planId || 'master_cdo_default';
      await saveLocalMasterDraft(currentId, fileName, itemsToSave, semanasToSave, false);
`);


fs.writeFileSync('src/components/MasterTab.tsx', content);
console.log("Done fixing TS 3");
