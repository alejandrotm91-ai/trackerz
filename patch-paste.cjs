const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const regexKeyDown = /const handleKeyDown = \(e: KeyboardEvent\) => \{[\s\S]*?\}\);/;
const replaceKeyDown = `const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (editingCell) {
          setEditingCell(null);
        }
      }
    };
    
    const handlePaste = (e: ClipboardEvent) => {
      if (!isOpen || editingCell || !activeCell) return;
      
      const pasteText = e.clipboardData?.getData('text');
      if (pasteText) {
        const { itemId, field, weekId } = activeCell;
        const isNumberField = ['qty', 'precio', 'step', 'cantPres'].includes(field);
        const cleanNum = isNumberField ? (parseFloat(pasteText.replace(/[$,]/g, '').trim()) || 0) : pasteText.trim();
        
        if (field === 'qty' && weekId) {
          onUpdateItemQuantity(activeCell.nodeKey, weekId, cleanNum as number); // Note nodeKey in activeCell, itemId not directly in activeCell
        } else if (['precio', 'step', 'cantPres'].includes(field)) {
          // We need itemId... activeCell doesn't store itemId? Let's check.
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, editingCell, activeCell]);`;

content = content.replace(regexKeyDown, replaceKeyDown);
// Actually activeCell has: nodeKey, field, weekId. It DOES NOT have itemId. 
// We can find itemId from nodes using nodeKey.
fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
