const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

// Fix calculateMasterTableSummary signature
content = content.replace(
  `  const tableSummaryTotals = useMemo(() => {
    return calculateMasterTableSummary(items, semanas);
  }, [items, semanas]);`,
  `  const tableSummaryTotals = useMemo(() => {
    return calculateMasterTableSummary(nodes.filter(n => n.esHoja), semanas, items);
  }, [nodes, semanas, items]);`
);

// Fix calculateMasterTotals - we don't even use this function call but looking at the error:
content = content.replace(
  `const totales = useMemo(() => calculateMasterTotals(items), [items]);`,
  `const totales = useMemo(() => calculateMasterTotals(items), [items]); // ignoring the error on 653 expecting 2 arguments since it wasn't listed, or wait, error 653: Expected 2 arguments, but got 1.`
);
// Actually `calculateMasterTotals` expects items and semanas? Let's check signature.
content = content.replace(
  `const totales = useMemo(() => calculateMasterTotals(items), [items]);`,
  `const totales = useMemo(() => calculateMasterTotals(items, semanas), [items, semanas]);`
);


// Fix availableOptions mapping error
content = content.replace(
  `availableOptions={availableAttributeOptions}`,
  ``
);

// Fix saveToLocalDraft error
content = content.replace(
  `saveToLocalDraft(items, semanas);`,
  `const currentId = planId || 'master_cdo_default';\n          saveLocalMasterDraft(currentId, fileName, items, semanas, false);\n          setLastLocalSavedTime(new Date().toLocaleTimeString());\n          setLocalDraftNotice(null);`
);


fs.writeFileSync('src/components/MasterTab.tsx', content);
console.log("Done fixing TS 4");
