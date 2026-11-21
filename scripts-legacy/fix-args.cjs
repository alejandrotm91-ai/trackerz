const fs = require('fs');
let content = fs.readFileSync('src/components/MasterTab.tsx', 'utf-8');

const brokenSection = `export function MasterTab({
  actividades,
  mapaColumnasMes,
  userName = 'Admin',
  isAdmin = true,
  onUpdateActividad,
  onAddActividad,
  onDeleteActividad?: (activityIdOrId: string) => void;,
  onBack
}: MasterTabProps) {`;

const fixedSection = `export function MasterTab({
  actividades,
  mapaColumnasMes,
  userName = 'Admin',
  isAdmin = true,
  onUpdateActividad,
  onAddActividad,
  onDeleteActividad,
  onBack
}: MasterTabProps) {`;

content = content.replace(brokenSection, fixedSection);
fs.writeFileSync('src/components/MasterTab.tsx', content);
