const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

const summaryDataCode = `
  const checkSetSummary = React.useMemo(() => {
    const summary: Record<string, {
      checkSetProps: any,
      tipologias: Record<string, { plan: number, ejec: number, desv: number, count: number }>,
      totalPlan: number,
      totalEjec: number,
      totalDesv: number,
      totalCount: number
    }> = {};

    leafItems.forEach(item => {
      const cs = getAccumulatedCheckSet([item]);
      const csKey = cs.text;
      if (!summary[csKey]) {
        summary[csKey] = {
          checkSetProps: cs,
          tipologias: {},
          totalPlan: 0,
          totalEjec: 0,
          totalDesv: 0,
          totalCount: 0
        };
      }
      
      const tipo = item.tipo || 'Sin Tipo';
      if (!summary[csKey].tipologias[tipo]) {
        summary[csKey].tipologias[tipo] = { plan: 0, ejec: 0, desv: 0, count: 0 };
      }
      
      const { vPlan, vEjec, variacion } = getItemWeekValues(item);
      
      summary[csKey].tipologias[tipo].plan += vPlan;
      summary[csKey].tipologias[tipo].ejec += vEjec;
      summary[csKey].tipologias[tipo].desv += variacion;
      summary[csKey].tipologias[tipo].count += 1;
      
      summary[csKey].totalPlan += vPlan;
      summary[csKey].totalEjec += vEjec;
      summary[csKey].totalDesv += variacion;
      summary[csKey].totalCount += 1;
    });

    // Ordenar Check Sets para que tengan un orden predecible
    const ordenCheckSets = ['Adelanto', 'En Plazo', 'Retraso'];
    
    return Object.entries(summary).sort((a, b) => {
       const idxA = ordenCheckSets.indexOf(a[0]);
       const idxB = ordenCheckSets.indexOf(b[0]);
       return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
    });
  }, [leafItems, getAccumulatedCheckSet, getItemWeekValues]);
`;

content = content.replace(
  "const globalTot = React.useMemo(() => tot(leafItems), [tot, leafItems]);",
  `const globalTot = React.useMemo(() => tot(leafItems), [tot, leafItems]);\n${summaryDataCode}`
);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
