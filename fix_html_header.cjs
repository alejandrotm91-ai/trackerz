const fs = require('fs');
let content = fs.readFileSync('src/components/ControlSemanalTabla.tsx', 'utf8');

content = content.replace(
  '<th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">% Avance</th>',
  '<th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: right;">% Avance</th>\n              <th style="padding: 8px 10px; border: 1px solid #64748b; background-color: #1e1b4b; color: #ffffff; font-weight: bold; text-align: center;">Check Set</th>'
);

fs.writeFileSync('src/components/ControlSemanalTabla.tsx', content);
