const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

content = content.replace(
  /      if \(searchQuery\.trim\(\)\) \{[\s\S]*?      \if \(filterCheckSet !== 'all'\) \{[\s\S]*?      \}\n      \}/,
  `      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const wbs = String(item.wbs || '').toLowerCase();
        const act = String(item.activityId || '').toLowerCase();
        const desc = String(item.descripcion || '').toLowerCase();
        const sub = String(item.subcontratista || item.subC || '').toLowerCase();
        if (!wbs.includes(q) && !act.includes(q) && !desc.includes(q) && !sub.includes(q)) {
          return false;
        }
      }

      if (filterCheckSet !== 'all') {
        const as = item.ventaPlan || 0;
        const av = item.ventaEjecutada || 0;
        const diff = as - av;
        if (filterCheckSet === 'en_plazo' && Math.abs(diff) > 1) return false;
        if (filterCheckSet === 'retraso' && diff <= 1) return false;
        if (filterCheckSet === 'adelanto' && diff >= -1) return false;
      }`
);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
