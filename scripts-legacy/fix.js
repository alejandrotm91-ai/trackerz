const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const brokenSection = `  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (loadCdoMenuRef.current && !loadCdoMenuRef.current.contains(e.target as Node)) {
        setIsLoadCdoMenuOpen(false);
      }
    };
    if (isLoadCdoMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
      // Close dropdown when clicking outside
  useEffect(() => {`;

const fixedSection = `  // Close dropdown when clicking outside
  useEffect(() => {`;

content = content.replace(brokenSection, fixedSection);
fs.writeFileSync('src/components/MasterTab.tsx', content);
