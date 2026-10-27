const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

// 1. Inject missing states below `const [isXlsMode, setIsXlsMode] = useState<boolean>(true);`
const statesToInject = `
  const [hierarchyMode, setHierarchyMode] = useState<MasterHierarchyMode>('wbs');
  const [hierarchyLevel, setHierarchyLevel] = useState<string>('all');
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState<string>('all');

  const { nodes, nodeMap, rootKeys } = useMemo(() => {
    return buildMasterHierarchyTree(items, hierarchyMode);
  }, [items, hierarchyMode]);

  const toggleNodeExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAllNodes = () => {
    const allKeys = new Set<string>();
    const traverse = (nList: MasterHierarchyNode[]) => {
      nList.forEach(n => {
        if (n.children && n.children.length > 0) {
          allKeys.add(n.key);
          traverse(n.children);
        }
      });
    };
    traverse(nodes);
    setExpandedKeys(allKeys);
  };

  const collapseAllNodes = () => {
    setExpandedKeys(new Set<string>());
  };

  const subcontratistasList = useMemo(() => {
    const subs = new Set<string>();
    items.forEach(item => {
      if (item.subcontratista) subs.add(item.subcontratista);
    });
    return Array.from(subs).sort();
  }, [items]);
`;

content = content.replace(
  "const [isXlsMode, setIsXlsMode] = useState<boolean>(true);",
  "const [isXlsMode, setIsXlsMode] = useState<boolean>(true);\n" + statesToInject
);

// 2. Fix saveToLocalDraft error
const localDraftSection = `  const triggerDataChange = (currentItems: MasterCdoItem[], currentSemanas: MasterCdoWeek[]) => {`;
const injectSaveToLocal = `
  const saveToLocalDraft = async (itemsToSave: MasterCdoItem[], semanasToSave: MasterCdoWeek[]) => {
    const currentId = planId || 'master_cdo_default';
    await saveLocalMasterDraft(currentId, fileName, itemsToSave, semanasToSave, false);
    setLastLocalSavedTime(new Date().toLocaleTimeString());
    setLocalDraftNotice(null);
  };
`;
content = content.replace(localDraftSection, injectSaveToLocal + "\n" + localDraftSection);

// 3. Fix handleUpdateItemQuantityFromXls
const brokenUpdateQuantity = `  const handleUpdateItemQuantityFromXls = (itemId: string, weekId: string, qty: number) => {
    const existingVal = items.find(i => i.id === itemId)?.semanas[weekId]?.qty || 0;
    if (existingVal === qty) return;
    
    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          semanas: {
            ...item.semanas,
            [weekId]: {
              ...item.semanas[weekId],
              qty
            }
          }
        };
      });
      triggerDataChange(newItems, semanas);
      return newItems;
    });
  };`;

const fixedUpdateQuantity = `  const handleUpdateItemQuantityFromXls = (itemId: string, weekId: string, qty: number) => {
    const existingVal = items.find(i => i.id === itemId)?.cantidadesSemanales[weekId] || 0;
    if (existingVal === qty) return;
    
    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          cantidadesSemanales: {
            ...item.cantidadesSemanales,
            [weekId]: qty
          }
        };
      });
      triggerDataChange(newItems, semanas);
      return newItems;
    });
  };`;
content = content.replace(brokenUpdateQuantity, fixedUpdateQuantity);

// 4. Fix handleRemoveWeek
const brokenRemoveWeek = `    // Also remove from items
    const newItems = items.map(item => {
      const { [weekId]: removed, ...restSemanas } = item.semanas;
      return {
        ...item,
        semanas: restSemanas
      };
    });`;
const fixedRemoveWeek = `    // Also remove from items
    const newItems = items.map(item => {
      const { [weekId]: removedCant, ...restCant } = item.cantidadesSemanales || {};
      const newVentas = { ...(item.ventasSemanales || {}) };
      delete newVentas[weekId];
      return {
        ...item,
        cantidadesSemanales: restCant,
        ventasSemanales: newVentas
      };
    });`;
content = content.replace(brokenRemoveWeek, fixedRemoveWeek);


// 5. Fix filterAvance logic
const brokenFilterAvance = `    // 2. Filter by Avance status
    if (filterAvance !== 'all') {
      currentLeaves = currentLeaves.filter(node => {
        const item = items.find(i => i.id === node.itemId);
        if (!item) return false;
        
        let hasAnyAvance = false;
        let qtyAvance = 0;
        
        Object.values(item.semanas).forEach(sem => {
          if (sem.qty > 0) hasAnyAvance = true;
          qtyAvance += sem.qty;
        });

        if (filterAvance === 'con_avance') {
          return hasAnyAvance;
        } else if (filterAvance === 'sin_avance') {
          return !hasAnyAvance;
        } else if (filterAvance === 'saldo_pendiente') {
          return item.cantPres > qtyAvance;
        }
        return true;
      });
    }`;

const fixedFilterAvance = `    // 2. Filter by Avance status
    if (filterAvance !== 'all') {
      currentLeaves = currentLeaves.filter(node => {
        const item = items.find(i => i.id === node.itemId);
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
      });
    }`;
content = content.replace(brokenFilterAvance, fixedFilterAvance);


fs.writeFileSync('src/components/MasterTab.tsx', content);
console.log("Done patching MasterTab.tsx");
