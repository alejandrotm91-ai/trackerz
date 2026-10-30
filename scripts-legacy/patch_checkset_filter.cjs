const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

// 1. Add filterCheckSet state
content = content.replace(
  "const [searchQuery, setSearchQuery] = React.useState<string>('');",
  "const [searchQuery, setSearchQuery] = React.useState<string>('');\n  const [filterCheckSet, setFilterCheckSet] = React.useState<'all' | 'retraso' | 'adelanto' | 'en_plazo'>('all');"
);

// 2. Update handleResetAllFilters
content = content.replace(
  "setSearchQuery('');\n  }, []);",
  "setSearchQuery('');\n    setFilterCheckSet('all');\n  }, []);"
);

// 3. Update activeFiltersCount
content = content.replace(
  "if (searchQuery.trim() !== '') count++;\n    return count;",
  "if (searchQuery.trim() !== '') count++;\n    if (filterCheckSet !== 'all') count++;\n    return count;"
);
content = content.replace(
  "excludePartidaD, filterVariacion, searchQuery]);",
  "excludePartidaD, filterVariacion, searchQuery, filterCheckSet]);"
);

// 4. Update leafItems filtering logic
content = content.replace(
  /      if \(searchQuery\.trim\(\)\) \{([\s\S]*?)      \}/,
  (match) => {
    return match + "\n\n      if (filterCheckSet !== 'all') {\n        const as = item.ventaPlan || 0;\n        const av = item.ventaEjecutada || 0;\n        const diff = as - av;\n        if (filterCheckSet === 'en_plazo' && Math.abs(diff) > 1) return false;\n        if (filterCheckSet === 'retraso' && diff <= 1) return false;\n        if (filterCheckSet === 'adelanto' && diff >= -1) return false;\n      }";
  }
);
content = content.replace(
  "filterVariacion, searchQuery, excludePartidaD, isPartidaD\n  ]);",
  "filterVariacion, searchQuery, excludePartidaD, isPartidaD, filterCheckSet\n  ]);"
);

// 5. Add UI for the filter
content = content.replace(
  "            {/* Clear / Reset All Filters Button */}",
  `            {/* Check Set Filter */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Check Set:</span>
              </label>
              <select
                value={filterCheckSet}
                onChange={(e) => setFilterCheckSet(e.target.value as any)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Todos</option>
                <option value="en_plazo">⚪ En Plazo</option>
                <option value="retraso">🔴 Retraso</option>
                <option value="adelanto">🟢 Adelanto</option>
              </select>
            </div>

            {/* Clear / Reset All Filters Button */}`
);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
