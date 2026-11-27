const fs = require('fs');
let content = fs.readFileSync('src/utils/masterCdoSync.ts', 'utf-8');

const oldSaveRegex = /export async function saveMasterCdoToFirebase[\s\S]*?(?=export async function loadLatestMasterCdoFromFirebase)/;

const newSave = `export async function saveMasterCdoToFirebase(
  planId: string,
  fileName: string,
  items: MasterCdoItem[],
  semanas: MasterCdoWeek[],
  userName: string = 'Admin',
  onProgress?: (pct: number, statusMsg: string) => void
): Promise<string> {
  if (onProgress) onProgress(10, 'Preparando sincronización con SQL...');
  
  const totales = calculateMasterTotals(items, semanas);
  
  const planData: MasterCdoPlanDoc = {
    id: planId,
    fileName: fileName,
    totalRows: items.length,
    semanas: semanas,
    updatedAt: new Date().toISOString(),
    updatedBy: userName,
    totales
  };

  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Debes iniciar sesión para sincronizar datos en la nube.");
  
  if (onProgress) onProgress(40, 'Enviando datos al servidor SQL...');
  const token = await currentUser.getIdToken();
  
  const response = await fetch('/api/master-cdo/save', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': \`Bearer \${token}\`
    },
    body: JSON.stringify({ planId, planData, items })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al guardar en el servidor SQL.');
  }

  if (onProgress) onProgress(100, '¡Guardado exitoso en SQL!');
  return planId;
}

`;

content = content.replace(oldSaveRegex, newSave);

fs.writeFileSync('src/utils/masterCdoSync.ts', content);
