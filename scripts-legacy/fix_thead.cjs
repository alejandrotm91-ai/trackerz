const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

// The incorrect tbody is around line 1010
// We need to find the added tbody in the HTML template and remove it.
const incorrectTbody = /<\/thead>\s*<tbody className="bg-indigo-950 text-white font-extrabold text-xs">\s*<tr>[\s\S]*?<\/tr>\s*<\/tbody>/;
const match = content.match(incorrectTbody);

if (match) {
  // Capture the inner row content to move it
  const rowMatch = match[0].match(/<tr>([\s\S]*?)<\/tr>/);
  if (rowMatch) {
    const rowContent = rowMatch[0];
    
    // revert the incorrect one
    content = content.replace(incorrectTbody, '</thead>');
    
    // Now find the REAL thead end, which is right before `<tbody className="divide-y divide-slate-100">`
    const realTheadEnd = /<\/thead>\s*<tbody className="divide-y divide-slate-100">/;
    content = content.replace(realTheadEnd, `</thead>\n              <tbody className="bg-indigo-950 text-white font-extrabold text-xs shadow-md z-10 sticky top-0">\n                \${rowContent}\n              </tbody>\n              <tbody className="divide-y divide-slate-100">`);
    
    // fix the template string interpolation issue for ${rowContent}
    content = content.replace(`\${rowContent}`, rowContent);
  }
}

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
