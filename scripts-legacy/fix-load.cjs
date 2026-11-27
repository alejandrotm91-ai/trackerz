const fs = require('fs');
let content = fs.readFileSync('src/utils/masterCdoSync.ts', 'utf-8');

// The new function I added is named loadMasterCdoFromFirebase.
// The old one is loadLatestMasterCdoFromFirebase.
// I will just replace the old loadLatestMasterCdoFromFirebase with my new fetch-based logic.

const oldLoadRegex = /export async function loadLatestMasterCdoFromFirebase[\s\S]*?(?=export async function parseMasterCdoFromExcel)/;

const newLoad = `export async function loadLatestMasterCdoFromFirebase(
  onProgress?: (pct: number, statusMsg: string) => void,
  chunkDelay: number = 0
): Promise<{
  planDoc: MasterCdoPlanDoc;
  items: MasterCdoItem[];
} | null> {
  const planId = 'master_cdo_default'; // Default plan ID for now
  if (onProgress) onProgress(10, 'Conectando a base de datos SQL...');
  
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("Debes iniciar sesión para descargar datos de la nube.");
  
  const token = await currentUser.getIdToken();
  
  if (onProgress) onProgress(50, 'Descargando información desde SQL...');
  const response = await fetch(\`/api/master-cdo/load/\${planId}\`, {
    headers: {
      'Authorization': \`Bearer \${token}\`
    }
  });

  if (response.status === 404) {
    return null; // Plan not found
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al descargar datos de SQL.');
  }

  if (onProgress) onProgress(90, 'Procesando datos recibidos...');
  const data = await response.json();
  
  if (onProgress) onProgress(100, '¡Descarga completa!');
  return data;
}

`;

content = content.replace(oldLoadRegex, newLoad);
fs.writeFileSync('src/utils/masterCdoSync.ts', content);
