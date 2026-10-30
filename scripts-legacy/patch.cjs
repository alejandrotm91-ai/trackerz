const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

content = content.replace(
  /const pctTipo = (.*?);([\s\S]*?)return \(/g,
  'const pctTipo = $1;\n                    const csTipo = getAccumulatedCheckSet(allItemsInTipo);$2return ('
);

content = content.replace(
  /<td className="px-3 py-2\.5 text-right font-mono text-white">\{pctTipo\.toFixed\(2\)\}%<\/td>\s*<\/tr>/g,
  '<td className="px-3 py-2.5 text-right font-mono text-white">{pctTipo.toFixed(2)}%</td>\n                          <td className="px-3 py-2.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csTipo.bg} ${csTipo.textC}`}><span className={`w-1 h-1 rounded-full ${csTipo.dot}`}></span>{csTipo.text}</span></td>\n                        </tr>'
);

content = content.replace(
  /const pctGrupo = (.*?);([\s\S]*?)return \(/g,
  'const pctGrupo = $1;\n                          const csGrupo = getAccumulatedCheckSet(allG);$2return ('
);

content = content.replace(
  /<td className="px-3 py-2 text-right font-mono">\{pctGrupo\.toFixed\(2\)\}%<\/td>\s*<\/tr>/g,
  '<td className="px-3 py-2 text-right font-mono">{pctGrupo.toFixed(2)}%</td>\n                                <td className="px-3 py-2 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csGrupo.bg} ${csGrupo.textC}`}><span className={`w-1 h-1 rounded-full ${csGrupo.dot}`}></span>{csGrupo.text}</span></td>\n                              </tr>'
);

content = content.replace(
  /const pctCap = (.*?);([\s\S]*?)return \(/g,
  'const pctCap = $1;\n                                const csCap = getAccumulatedCheckSet(allCap);$2return ('
);

content = content.replace(
  /<td className="px-3 py-2 text-right font-mono">\{pctCap\.toFixed\(2\)\}%<\/td>\s*<\/tr>/g,
  '<td className="px-3 py-2 text-right font-mono">{pctCap.toFixed(2)}%</td>\n                                      <td className="px-3 py-2 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csCap.bg} ${csCap.textC}`}><span className={`w-1 h-1 rounded-full ${csCap.dot}`}></span>{csCap.text}</span></td>\n                                    </tr>'
);

content = content.replace(
  /const pctScap = (.*?);([\s\S]*?)return \(/g,
  'const pctScap = $1;\n                                      const csScap = getAccumulatedCheckSet(allS);$2return ('
);

content = content.replace(
  /<td className="px-3 py-1\.5 text-right font-mono">\{pctScap\.toFixed\(2\)\}%<\/td>\s*<\/tr>/g,
  '<td className="px-3 py-1.5 text-right font-mono">{pctScap.toFixed(2)}%</td>\n                                            <td className="px-3 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csScap.bg} ${csScap.textC}`}><span className={`w-1 h-1 rounded-full ${csScap.dot}`}></span>{csScap.text}</span></td>\n                                          </tr>'
);

content = content.replace(
  /const pctSubC = (.*?);([\s\S]*?)return \(/g,
  'const pctSubC = $1;\n                                            const csSubC = getAccumulatedCheckSet(items);$2return ('
);

content = content.replace(
  /<td className="px-3 py-1\.5 text-right font-mono">\{pctSubC\.toFixed\(2\)\}%<\/td>\s*<\/tr>/g,
  '<td className="px-3 py-1.5 text-right font-mono">{pctSubC.toFixed(2)}%</td>\n                                                  <td className="px-3 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csSubC.bg} ${csSubC.textC}`}><span className={`w-1 h-1 rounded-full ${csSubC.dot}`}></span>{csSubC.text}</span></td>\n                                                </tr>'
);

content = content.replace(
  /const pctItem = (.*?);([\s\S]*?)return \(/g,
  'const pctItem = $1;\n                                                  const csItem = getAccumulatedCheckSet([item]);$2return ('
);

content = content.replace(
  /<td className="px-3 py-1\.5 text-right font-mono">\{pctItem\.toFixed\(2\)\}%<\/td>\s*<\/tr>/g,
  '<td className="px-3 py-1.5 text-right font-mono">{pctItem.toFixed(2)}%</td>\n                                                      <td className="px-3 py-1.5 text-center font-mono"><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${csItem.bg} ${csItem.textC}`}><span className={`w-1 h-1 rounded-full ${csItem.dot}`}></span>{csItem.text}</span></td>\n                                                    </tr>'
);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
