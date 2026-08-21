const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

// 1. Insert state
content = content.replace(
  "const [expandedSubPartidas, setExpandedSubPartidas] = React.useState<Set<string>>(new Set());",
  "const [expandedSubPartidas, setExpandedSubPartidas] = React.useState<Set<string>>(new Set());\n  const [expandedCheckSets, setExpandedCheckSets] = React.useState<Set<string>>(new Set());"
);

// 2. Replace tr mapping
const oldTr = /<tr className="bg-slate-100 font-bold">\s*<td className="px-4 py-3 border-b border-slate-200">\s*<span className=\{\`inline-flex items-center gap-1\.5 px-2 py-1 rounded-md text-\[10px\] font-bold uppercase \$\{csData\.checkSetProps\.bg\} \$\{csData\.checkSetProps\.textC\}\`\}>\s*<span className=\{\`w-1\.5 h-1\.5 rounded-full \$\{csData\.checkSetProps\.dot\}\`\}><\/span>\{csKey\}\s*<\/span>\s*<\/td>/;

const newTr = `<tr 
                             className="bg-slate-100 font-bold cursor-pointer hover:bg-slate-200 transition-colors"
                             onClick={() => setExpandedCheckSets(prev => {
                               const next = new Set(prev);
                               if (next.has(csKey)) next.delete(csKey); else next.add(csKey);
                               return next;
                             })}
                           >
                             <td className="px-4 py-3 border-b border-slate-200">
                               <div className="flex items-center gap-1.5">
                                 {expandedCheckSets.has(csKey) ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
                                 <span className={\`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold uppercase \${csData.checkSetProps.bg} \${csData.checkSetProps.textC}\`}>
                                   <span className={\`w-1.5 h-1.5 rounded-full \${csData.checkSetProps.dot}\`}></span>{csKey}
                                 </span>
                               </div>
                             </td>`;

content = content.replace(oldTr, newTr);

// 3. Replace {tipos.map... with {expandedCheckSets.has(csKey) && tipos.map...
content = content.replace(
  /\{tipos\.map\(\(\[tipo, tData\]\) => \(/,
  "{expandedCheckSets.has(csKey) && tipos.map(([tipo, tData]) => ("
);

// 4. Add tfoot right after </tbody> of checkSetSummary
const tfootCode = `                  </tbody>
                  <tfoot className="bg-slate-900 text-white font-extrabold text-xs">
                    <tr>
                      <td className="px-4 py-3 border-t border-slate-800" colSpan={2}>
                        TOTAL GENERAL
                      </td>
                      <td className="px-4 py-3 border-t border-slate-800 text-right font-mono text-indigo-300">
                        \${fmtMoney(globalTot.plan)}
                      </td>
                      <td className="px-4 py-3 border-t border-slate-800 text-right font-mono text-rose-300">
                        \${fmtMoney(globalTot.ejec)}
                      </td>
                      <td className={\`px-4 py-3 border-t border-slate-800 text-right font-mono \${globalTot.desv < 0 ? 'text-rose-400' : 'text-emerald-400'}\`}>
                        {fmtDNum(globalTot.desv)}
                      </td>
                      <td className="px-4 py-3 border-t border-slate-800 text-center font-mono">
                        {leafItems.length}
                      </td>
                    </tr>
                  </tfoot>
                </table>`;

content = content.replace(/<\/tbody>\s*<\/table>/, tfootCode);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
