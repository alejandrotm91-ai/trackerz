const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

// Find the tfoot block
const tfootRegex = /<tfoot className="bg-indigo-950 text-white font-extrabold text-xs">([\s\S]*?)<\/tfoot>/;
const match = content.match(tfootRegex);

if (!match) {
  console.log("Could not find tfoot block");
  process.exit(1);
}

const tfootBlock = match[0];
const innerContent = match[1];

// Remove the tfoot block
content = content.replace(tfootRegex, '');

// Insert it right after </thead> as a <tbody>
const theadEndRegex = /<\/thead>/;
const replacement = `</thead>\n              <tbody className="bg-indigo-950 text-white font-extrabold text-xs">${innerContent}</tbody>`;
content = content.replace(theadEndRegex, replacement);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
