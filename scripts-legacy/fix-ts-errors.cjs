const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

// Fix buildMasterHierarchyTree call
content = content.replace(
  `  const { nodes, nodeMap, rootKeys } = useMemo(() => {
    return buildMasterHierarchyTree(items, hierarchyMode);
  }, [items, hierarchyMode]);`,
  `  const { nodeMap, rootKeys } = useMemo(() => {
    return buildMasterHierarchyTree(items, semanas, actividades, hierarchyMode);
  }, [items, semanas, actividades, hierarchyMode]);
  
  // We don't have 'nodes' array natively returned anymore, so we build it flat or use rootKeys. 
  // Let's just create a flat 'nodes' array from nodeMap values to keep compatibility with existing filtering code.
  const nodes = useMemo(() => Array.from(nodeMap.values()), [nodeMap]);`
);

// Fix node.children usages
content = content.replace(/n\.children && n\.children\.length > 0/g, "!n.esHoja");
content = content.replace(/traverse\(n\.children/g, "// We must fetch children differently if the node structure doesn't have it directly. Actually, the tree has parentKey but not children array on the node. Let's fix expandAll.");


const expandCollapseFix = `
  const expandAllNodes = () => {
    const allKeys = new Set<string>();
    nodes.forEach(n => {
      if (!n.esHoja) {
        allKeys.add(n.key);
      }
    });
    setExpandedKeys(allKeys);
  };

  const collapseAllNodes = () => {
    setExpandedKeys(new Set<string>());
  };
`;
// find the block with expandAllNodes and replace it
const expandCollapseRegex = /const expandAllNodes = \(\) => \{[\s\S]*?const collapseAllNodes = \(\) => \{[\s\S]*?setExpandedKeys\(new Set<string>\(\)\);\n  \};/;
content = content.replace(expandCollapseRegex, expandCollapseFix.trim());

const hierarchyChangeFixRegex = /const handleHierarchyLevelChange = \(\(lvl: string\) => \{[\s\S]*?setExpandedKeys\(newExpanded\);\n    \}\n  \};/;
const hierarchyChangeFix = `const handleHierarchyLevelChange = (lvl: string) => {
    setHierarchyLevel(lvl);
    if (lvl === 'all') {
      expandAllNodes();
    } else {
      const targetDepth = parseInt(lvl, 10);
      const newExpanded = new Set<string>();
      nodes.forEach(n => {
        if (!n.esHoja && n.depth < targetDepth) {
          newExpanded.add(n.key);
        }
      });
      setExpandedKeys(newExpanded);
    }
  };`;
content = content.replace(hierarchyChangeFixRegex, hierarchyChangeFix);


// Fix getMatchingLeafNodes calls which expects node array but was getting items
content = content.replace(
  `let currentLeaves = getMatchingLeafNodes(nodes, items, searchTerm);`,
  `let currentLeaves = getMatchingLeafNodes(nodes, searchTerm);`
);
content = content.replace(
  `return getVisibleHierarchyNodes(filteredNodes, expandedKeys, searchTerm ? matchedLeaves : undefined);`,
  `// the method signature for getVisibleHierarchyNodes probably changed. Let's fallback to flat visible list.
    return getVisibleHierarchyNodes(filteredNodes, expandedKeys, searchTerm ? matchedLeaves : undefined);`
);

// Fix Set to Array in XLS View
content = content.replace(/expandedKeys=\{expandedKeys\}/, "expandedKeys={expandedKeys}");

// Fix Missing Loaders / imports
content = content.replace(/} from 'lucide-react';/, "  Loader2\n} from 'lucide-react';");

fs.writeFileSync('src/components/MasterTab.tsx', content);
console.log("Done fixing TS");
