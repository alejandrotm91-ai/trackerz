const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

// The tfootCode that was accidentally placed inside the HTML template
const tfootCode = `                  <tfoot className="bg-slate-900 text-white font-extrabold text-xs">
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

// Revert the HTML template part
content = content.replace(
  `          <tbody>\n            \${htmlRows}\n                            </tbody>\n${tfootCode}`,
  `          <tbody>\n            \${htmlRows}\n          </tbody>\n        </table>`
);

// Now apply it to the actual React component
// We can find the correct place by searching for the end of the checkSetSummary map
const correctLocationMatch = content.match(/\{\/\* Filas de Tipologías \*\/\}([\s\S]*?)<\/tbody>\s*<\/table>\s*<\/div>\s*<\/div>\s*\)\}/);

if (correctLocationMatch) {
  content = content.replace(
    correctLocationMatch[0],
    correctLocationMatch[0].replace('</tbody>\n                </table>', '</tbody>\n' + tfootCode)
  );
}

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
