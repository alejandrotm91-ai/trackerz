const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

const fieldsToPatch = ['macro', 'grupo', 'tipo', 'partidas', 'cap', 'scap', 'unit', 'componente', 'ubicacion', 'proceso', 'resp'];

for (const field of fieldsToPatch) {
  // First, let's find the onClick
  const oldOnClick = `onClick={isLeaf && item ? () => onOpenAttributesModal(item, node.activityId || item.id) : undefined}`;
  const newOnClick = `onClick={isLeaf && item ? (e) => { e.stopPropagation(); startCellEdit(node.key, item.id, '${field}', node.${field} || ''); } : undefined}`;
  
  content = content.replaceAll(oldOnClick, newOnClick);
  
  // Now let's replace the inner text content for each of these fields
  const oldTextEmpty = `{node.${field} || (isLeaf ? <span className="text-slate-300 italic">vacío</span> : '—')}`;
  const oldTextDash = `{node.${field} || (isLeaf ? <span className="text-slate-300 italic">—</span> : '—')}`;
  
  const newInput = `{isLeaf && item && editingCell?.itemId === item.id && editingCell?.field === '${field}' ? (
    <input
      autoFocus
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={() => commitEditAndNavigate()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitEditAndNavigate();
        } else if (e.key === 'Escape') {
          setEditingCell(null);
        }
      }}
      className="w-full h-full text-[10.5px] p-0 outline-hidden ring-1 ring-indigo-500 font-bold text-slate-800 bg-white"
    />
  ) : (
    node.${field} || (isLeaf ? <span className="text-slate-300 italic">—</span> : '—')
  )}`;

  content = content.replace(oldTextEmpty, newInput);
  content = content.replace(oldTextDash, newInput);
}

fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
