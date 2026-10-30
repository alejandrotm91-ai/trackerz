const fs = require('fs');
let content = fs.readFileSync('src/components/MasterXlsSheetView.tsx', 'utf-8');

// 1. Replace the state
const oldState = `  // High performance pagination / slicing in XLS view
  const [xlsPage, setXlsPage] = useState<number>(1);
  const [xlsItemsPerPage, setXlsItemsPerPage] = useState<number>(100);

  // Reset page when filters or expansion changes
  useEffect(() => {
    setXlsPage(1);
  }, [searchTerm, filterSubc, filterAvance, hierarchyMode, filteredNodes.length]);

  const totalPages = Math.max(1, Math.ceil(filteredNodes.length / xlsItemsPerPage));
  const paginatedNodes = useMemo(() => {
    if (xlsItemsPerPage >= 9999) return filteredNodes;
    const start = (xlsPage - 1) * xlsItemsPerPage;
    return filteredNodes.slice(start, start + xlsItemsPerPage);
  }, [filteredNodes, xlsPage, xlsItemsPerPage]);`;

const newState = `  // High performance infinite scrolling in XLS view
  const [renderLimit, setRenderLimit] = useState<number>(100);

  // Reset limit when filters or expansion changes
  useEffect(() => {
    setRenderLimit(100);
  }, [searchTerm, filterSubc, filterAvance, hierarchyMode, filteredNodes.length, expandedKeys]);

  const paginatedNodes = useMemo(() => {
    return filteredNodes.slice(0, renderLimit);
  }, [filteredNodes, renderLimit]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop <= clientHeight + 500) {
      if (renderLimit < filteredNodes.length) {
        setRenderLimit(prev => Math.min(prev + 100, filteredNodes.length));
      }
    }
  };`;

content = content.replace(oldState, newState);

// 2. Attach handleScroll to the container
content = content.replace(
  '<div className="flex-1 overflow-auto relative bg-white">',
  '<div className="flex-1 overflow-auto relative bg-white" onScroll={handleScroll}>'
);

// 3. Fix row index calculation
content = content.replace(
  'const rowIdx = (xlsPage - 1) * (xlsItemsPerPage >= 9999 ? 0 : xlsItemsPerPage) + localIdx;',
  'const rowIdx = localIdx;'
);

fs.writeFileSync('src/components/MasterXlsSheetView.tsx', content);
