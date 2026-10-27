const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const newMethod = `  const handleUpdateItemPropertyFromXls = (itemId: string, field: 'precio' | 'step' | 'cantPres', val: number) => {
    const existingVal = items.find(i => i.id === itemId)?.[field] || 0;
    if (existingVal === val) return;

    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          [field]: val
        };
      });
      triggerDataChange(newItems, semanas);
      return newItems;
    });
  };

  const handleUpdateItemStringPropertyFromXls = (itemId: string, field: string, val: string) => {
    setItems(prev => {
      const newItems = prev.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          [field]: val
        };
      });
      triggerDataChange(newItems, semanas);
      return newItems;
    });
  };`;

content = content.replace(/  const handleUpdateItemPropertyFromXls[\s\S]*?return newItems;\n    \}\);\n  \};/, newMethod);

const newProps = `        onUpdateItemProperty={handleUpdateItemPropertyFromXls}
        onUpdateItemStringProperty={handleUpdateItemStringPropertyFromXls}`;

content = content.replace(/        onUpdateItemProperty=\{handleUpdateItemPropertyFromXls\}/, newProps);

fs.writeFileSync('src/components/MasterTab.tsx', content);
