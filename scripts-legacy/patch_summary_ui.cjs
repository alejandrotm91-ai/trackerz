const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

const summaryUI = `
          {/* Resumen Check Set */}
          {checkSetSummary.length > 0 && (
            <div className="mt-8 space-y-3">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                Resumen por Check Set y Tipología
              </h3>
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="min-w-full text-xs border-collapse text-left">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold w-40">Check Set</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold">Tipología</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-right">V. Plan (PG-004)</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-right">V. Ejec. (CDO V-)</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-right">Variación</th>
                      <th className="px-4 py-3 border-b border-slate-700 font-bold text-center w-32">Cant. Actividades</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {checkSetSummary.map(([csKey, csData]) => {
                       const tipos = Object.entries(csData.tipologias).sort((a, b) => b[1].desv - a[1].desv);
                       return (
                         <React.Fragment key={csKey}>
                           {/* Fila del Check Set (Total) */}
                           <tr className="bg-slate-100 font-bold">
                             <td className="px-4 py-3 border-b border-slate-200">
                               <span className={\`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase \${csData.checkSetProps.bg} \${csData.checkSetProps.textC}\`}>
                                 <span className={\`w-1.5 h-1.5 rounded-full \${csData.checkSetProps.dot}\`}></span>{csKey}
                               </span>
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-slate-600 text-[10px] uppercase tracking-wider font-extrabold">
                               Total {csKey}
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-right text-indigo-700 font-mono">
                               \${fmtMoney(csData.totalPlan)}
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-right text-rose-700 font-mono">
                               \${fmtMoney(csData.totalEjec)}
                             </td>
                             <td className={\`px-4 py-3 border-b border-slate-200 text-right font-mono font-black \${csData.totalDesv < 0 ? 'text-rose-600' : 'text-emerald-600'}\`}>
                               {fmtDNum(csData.totalDesv)}
                             </td>
                             <td className="px-4 py-3 border-b border-slate-200 text-center font-bold text-slate-800 bg-slate-200/50">
                               {csData.totalCount}
                             </td>
                           </tr>
                           
                           {/* Filas de Tipologías */}
                           {tipos.map(([tipo, tData]) => (
                             <tr key={\`\${csKey}-\${tipo}\`} className="bg-white hover:bg-slate-50 transition-colors">
                               <td className="px-4 py-2 border-r border-slate-100 bg-slate-50/30"></td>
                               <td className="px-4 py-2 text-slate-700 font-medium pl-6 relative">
                                 <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200"></div>
                                 <span className="text-[11px]">{tipo}</span>
                               </td>
                               <td className="px-4 py-2 text-right font-mono text-slate-600">
                                 \${fmtMoney(tData.plan)}
                               </td>
                               <td className="px-4 py-2 text-right font-mono text-slate-600">
                                 \${fmtMoney(tData.ejec)}
                               </td>
                               <td className={\`px-4 py-2 text-right font-mono font-bold \${tData.desv < 0 ? 'text-rose-600' : 'text-emerald-600'}\`}>
                                 {fmtDNum(tData.desv)}
                               </td>
                               <td className="px-4 py-2 text-center font-mono text-slate-600 font-medium border-l border-slate-100">
                                 {tData.count}
                               </td>
                             </tr>
                           ))}
                         </React.Fragment>
                       );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
`;

content = content.replace(
  /                          <\/table>\n          <\/div>\n        <\/div>\n      <\/div>\n    \)}/,
  `                          </table>
          </div>
${summaryUI}
        </div>
      </div>
    )}`
);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
