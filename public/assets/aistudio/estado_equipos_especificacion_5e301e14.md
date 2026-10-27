# Estado de Equipos PTAR Merinos: especificación funcional y de datos

Versión 9 · 23-oct-2026 · Contrato EC-EMAPAG-CW-RFB-007 (PTAR Los Merinos + EBAR Progreso)

Referencia funcional: `estado_equipos.html` (aplicativo completo, con datos del Master de la semana 18-Oct-26). Este documento describe qué hace y cómo calcula cada cifra, de modo que se pueda reimplementar en otra web app con resultados idénticos.

---

## 1. Objetivo

Consultar el estado de los equipos electromecánicos del proyecto, desagregado en tres etapas:

| Etapa | Sufijo del Activity ID | Grupo en el Master | Nombre en pantalla | Verbo |
|---|---|---|---|---|
| D | `.D` | `02.Procura_Eq.` | Compra y fabricación (abreviado "Fabr.") | fabricadas |
| E | `.E` | `03.Flete_Eq.` | Flete a obra | fleteadas |
| F | `.F` | `04.Precom_Eq.` | Instalación y pruebas | instaladas |

La consulta se hace por **Proceso** y **Estructura (CAP)** o por **Proveedor**. Responde preguntas como: "En Estructura de Entrada - Pretratamiento, ¿cuántas compuertas de CMO están fabricadas, fleteadas e instaladas de un total de N?".

## 2. Fuente de datos: única

**Archivo:** `2. Master.xlsx` · **Pestaña:** `cdo` · **Fila de encabezados:** la 2 (la fila 1 trae totales y hay que ignorarla). Las columnas se buscan **por nombre de encabezado**, no por posición. Las letras de la tabla son solo una referencia de la versión actual.

| Encabezado | Col. actual | Uso |
|---|---|---|
| `Activity ID` | C | Clave. Termina en `.D`, `.E` o `.F`; la base (sin sufijo) identifica el equipo |
| `Activity Name` | D | Descripción del equipo |
| `Unidad` | E | Unidad de la cantidad (u, m, kg, gl…) |
| `Cantidad` | F | Total del equipo |
| `Venta` | I | Valor de la etapa (pondera el % por valor) |
| `SubC` | J | Proveedor (en .D) / instalador (en .F) |
| `Contrato` | Q | Original / variación |
| `p6` | S | Activity Status: `Not Started`, `In Progress` o `Completed` |
| `blFinish` | U | Fin de línea base |
| `Start` | V | Inicio (real o planificado) |
| `Finish` | W | Fin (real o planificado) |
| `Float` | X | Total Float en días |
| `Grupos` | Z | Filtro del universo |
| `Ubicacion` | AA | Merinos / Progreso / … |
| `Proceso` | AB | Agrupación superior (pestañas) |
| `CAP` | AE | Estructura |
| `SCAP` | AF | Subestructura / familia |
| `Unit` | AG | Tipo de equipo (familia) |
| `Obs` | AL | Ruta WBS; detecta partidas "pendientes de regularizar" |
| `% Ex` | AP | % ejecutado de la etapa (0 a 1) |
| `Cantidad Ex` | AQ | Cantidad ejecutada de la etapa |
| `Venta Ex` | AR | Valor ejecutado de la etapa |

La columna `blStart` (T) existe pero no se usa.

**Columnas semanales** `V-dd-mmm-yy` (pares `C-`/`V-`): sirven solo para detectar la **semana de corte**. Se suman los valores absolutos de las últimas 12 columnas `V-`, y la última con suma > 1000 es la semana que se muestra como "ejecución hasta …".

**Fechas:** vienen como número serial de Excel (días desde 1899-12-30). Se convierten a ISO `YYYY-MM-DD`. Algunas filas traen texto (por ejemplo, el literal `p6`); en ese caso se tratan como sin dato.

**Filtro de filas:** solo las filas con `Grupos` ∈ {`02.Procura_Eq.`, `03.Flete_Eq.`, `04.Precom_Eq.`}. Con el Master actual son 2.607 filas, que forman 869 equipos.

## 3. Modelo de datos

```ts
type StageKey = 'D' | 'E' | 'F';

interface Stage {
  id: string;            // Activity ID completo
  name: string;
  qty: number;           // Cantidad (0 si vacía)
  venta: number;         // Venta
  vex: number;           // Venta Ex
  pex: number | null;    // % Ex
  ex: number;            // ejecutado (ver regla 3.2)
  done: boolean;         // terminada (ver regla 3.3)
  status: string | null; // columna p6
  subc: string;
  start: string | null;  startA: boolean;  // A = real
  fin: string | null;    finA: boolean;
  blf: string | null;    // blFinish
  tf: number | null;     // Float
  missing?: boolean;     // la etapa no existe en el Master
}

interface Equipo {
  base: string;          // Activity ID sin .D/.E/.F
  proc: string; cap: string; scap: string; ubic: string;
  fam: string;           // Unit || SCAP || '(sin tipo)'
  und: string;           // Unidad (por defecto 'u')
  qty: number;           // Cantidad (la de la etapa D tiene prioridad)
  contrato: string;
  desc: string;          // descripción limpia
  prov: string;          // proveedor
  inst: string;          // instalador si difiere del proveedor
  pend: boolean;         // pendiente de regularizar (WBS D)
  s: Record<StageKey, Stage>;
}
```

### 3.1 Construcción del equipo
1. Todos los textos se recortan (`trim`), porque hay proveedores con espacios al final, por ejemplo `"HUBER "`.
2. `Activity ID` debe cumplir `/^(.*)\.([DEF])$/i`. `base` es el grupo 1.
3. La etapa sale de `Grupos` (`02`→D, `03`→E, `04`→F). Si no se puede mapear, se usa el sufijo.
4. El primer registro de una base crea el equipo. La etapa **D** sobrescribe `qty`, `und`, `scap`, `fam`, `cap` y `proc` (es la fila de referencia).
5. `desc` es el `Activity Name` de la etapa D sin el prefijo `Compra y fabricación (de)`. Si no hay D, se usa el nombre de F o E sin `Flete de equipo a obra de` / `Instalación y pruebas de`.
6. `prov` = SubC de D → E → F, o `(sin proveedor)` si ninguna lo trae. `inst` = SubC de F si es distinto de `prov`.
7. Una etapa ausente se rellena con `{ex:0, qty:equipo.qty, venta:0, vex:0, done:false, status:null, missing:true}`.
8. `pend = /^p\d+\.D(\.|$)/i.test(Obs)`, es decir, la rama WBS `p0926.D` (cantidades originales por regularizar con el Ingeniero).
9. Los equipos se ordenan por `base` con orden natural: segmentos numéricos comparados como números.

### 3.2 Ejecutado
`ex = Cantidad Ex` si es numérica; si no, `% Ex × Cantidad`; si no, `0`.

En compra y fabricación la Cantidad Ex refleja hitos de pago: 3 u al 90 % se leen como 2,7 u.

### 3.3 Terminada
`done = status === 'Completed' || %Ex ≥ 0.999 || (qty > 0 && ex ≥ qty × 0.999)`

### 3.4 Fechas reales
El Master no trae la marca "A" de P6, así que se infiere del estado:
- `startA = status ∈ {Completed, In Progress}`
- `finA = status === Completed`

### 3.5 Estado
`status = p6` recortado; si el valor es vacío o el literal `'p6'`, queda `null`.

## 4. Universo y filtros

**Universo** (base de todo): equipos con `!pend && qty > 0`. Con la casilla "Incluir pendientes de regularizar (WBS D)" activa entran todos.

**Filtrado** (se aplican todos, con AND):
1. **Agua** activo: `(proc, CAP)` ∈ selección Agua, y no es eléctrico de lodos si la casilla de exclusión está activa (sección 8).
2. **Modo "Partidas terminadas"**: al menos una etapa con `done`.
3. **Pestaña de proceso**: `proc === UI.proc`, o todas si es `*`.
4. **Proveedor** seleccionado: `prov === UI.prov`.
5. **Búsqueda** (sin distinguir mayúsculas): contiene el texto en `base`, `desc`, `prov`, `inst`, `cap`, `fam` o `scap`.

## 5. Agregación (`agg(list)`)

Para cualquier conjunto de equipos (pestaña, KPI, tarjeta, fila):

- `n` = número de equipos.
- `q[unidad]` = Σ qty por unidad. **Las cantidades solo se suman dentro de la misma unidad.**
- Por etapa k:
  - `ex[unidad]` = Σ `s[k].ex`
  - `dn[unidad]` = Σ `qty` de los equipos con `s[k].done`
  - `v` = Σ `venta`, `vx` = Σ `vex`, y `pv = vx / v` (% por valor; `null` si v = 0)
- `tf` = mínimo Float de las etapas **no terminadas** con `Float < 400`. El valor 500 que P6 pone a las terminadas se ignora.
- `fin` = máximo `Finish` de F; `blf` = máximo `blFinish` de F.
- `maxLate` = máximo de `(Finish F − blFinish F)` en días, solo entre equipos con F no terminada.
- `units` = unidades ordenadas: `u` primero, luego de mayor a menor cantidad.

**Fracción por etapa** (barras y estado): con `u0 = units[0]`, `frac[k] = (modo ex ? ex[u0] : dn[u0]) / q[u0]`. Si `q = 0`, se usa `pv`.

## 6. Reglas de lectura

**Estado textual** (`stateOf`, sobre las fracciones):

| Condición (en orden) | Texto | Color |
|---|---|---|
| F ≥ 0,999 | Instalado | instalación |
| F > 0 | En instalación | instalación |
| E ≥ 0,999 | En obra | flete |
| E > 0 | Flete en curso | flete |
| D ≥ 0,999 | Fabricado | fabricación |
| D > 0 | En fabricación | fabricación |
| resto | Sin iniciar | gris |

**Riesgo por Total Float:** sin dato → "—"; ≤ 0 Crítico; 1 a 20 Alto; 21 a 30 Moderado; > 30 Moderado-Bajo.

**Retraso** = `Finish(.F) − blFinish(.F)` en días. Se muestra en rojo con `+` si es positivo y en verde si es negativo; se omite si es 0 o si F está terminada.

**Frase resumen** (se copia con "Copiar resumen"): `«Proveedor» — «tipo»: X fabricadas, Y fleteadas y Z instaladas de un total de N u.`. Con varias unidades se separan con `;`. En modo terminadas, X/Y/Z usan `dn`.

## 7. Interfaz

### 7.1 Encabezado fijo
- Título "Estado de Equipos PTAR Merinos" y subtítulo "Compra y fabricación · Flete · Instalación — por proceso y estructura (CAP)".
- Fuente: `Master · 2. Master.xlsx · ejecución hasta 18-Oct-26`.
- Botones a la derecha: **Expandir/Colapsar tarjetas** (alterna todo) y **Actualizar Master** (abre el panel de carga).

### 7.2 Panel de carga (oculto por defecto)
- Un solo selector de archivo: `2. Master.xlsx` (.xlsx/.xlsm/.xls).
- Botones **Procesar** y **Volver a la carga original**, más un mensaje de estado (rojo si hay error, verde si se cargó bien).
- Errores que se validan:
  - Faltan columnas: "En 2. Master no encontré la pestaña cdo con las columnas …".
  - No hay filas de los grupos 02/03/04.
  - La librería de lectura no cargó.
- El archivo se lee en el navegador. El resultado procesado se guarda como la "carga vigente".

### 7.3 Pestañas de proceso
- "Todos los procesos" seguida de cada Proceso del universo, ordenados alfabéticamente.
- Cada pestaña muestra el nombre, "N equipos · M estructuras" y tres minibarras con el % por valor de D, E y F.
- Pestaña inicial: `01.Pretratamiento & Clarif.`

### 7.4 KPIs (4 tarjetas, sobre la lista filtrada)
- Una por etapa: `ejecutado / total u` en unidad `u`, una barra, "% en unidades · % en valor" y, debajo, las otras unidades.
- "Equipos en la selección": N partidas · estructuras · proveedores · cuántos equipos tienen alguna etapa pendiente con Float ≤ 0.

### 7.5 Controles
De izquierda a derecha:
- Botón **Agua**.
- **Agrupar por**: Estructura | Proveedor.
- **Cantidad**: Cantidad Ex | Partidas terminadas.
- Búsqueda.
- Selector de proveedor (lista del proceso activo).
- Casilla "Incluir pendientes de regularizar (WBS D)".

### 7.6 Lista
- **Grupo exterior:** Estructura → clave `proc¦CAP`; Proveedor → `prov`.
- **Grupo interior (filas):** Estructura → `prov¦fam¦und`; Proveedor → `CAP¦fam¦und`.
- **Bandas de proceso:** solo con Agrupar = Estructura y pestaña "Todos los procesos".
  - Las tarjetas de estructura se agrupan bajo una banda por Proceso. Si Agua está activo, se agrupan por tramo de la ruta del agua.
  - La banda muestra el nombre, "N estructuras · M equipos" y los % por valor de Fabr., Flete e Instalación.
  - Las bandas están **colapsadas por defecto**.
- **Orden de las tarjetas:**
  - Con Agua: orden del flujo (sección 8).
  - Con bandas: por proceso y luego por `base`.
  - Por proveedor: alfabético.
- **Tarjeta (colapsada por defecto).** El encabezado completo es clicable y lleva:
  - un botón ▸/▾
  - el título (CAP o proveedor)
  - meta: "proceso · N equipos · M proveedores" o "N estructuras"
  - los tres % por valor (Fabr. / Flete / Instalación)
  - el botón "Copiar resumen"
- **Tabla de la tarjeta** (al expandir). Columnas:
  - Proveedor · tipo de equipo (subtítulo "Instala: …" o SCAP)
  - Partidas
  - Compra y fabricación, Flete a obra e Instalación y pruebas, cada una como `ejecutado / total und` con barra
  - Fin instalación (y "LB fecha · ±d")
  - Total Float ("N d · Riesgo")
  - Estado (chip)
- **Detalle por fila** (clic o Enter). Subtabla por equipo con:
  - Activity ID base y Equipo (con la etiqueta "WBS D" si está pendiente, y "Instala: …")
  - Cant.
  - Fabricación (.D), Flete (.E) e Instalación (.F): punto de estado (lleno = terminada, medio = en curso, vacío = sin iniciar) y `ex/qty · status`
  - Fin esperado .F (con " A" si es real), LB .F y Retraso
  - TF pendiente (mínimo de las etapas no terminadas)
  - Contrato
- **Vacío:** "No hay equipos con estos filtros. Prueba con otro proceso o borra la búsqueda."

### 7.7 "Cómo se calcula"
Bloque desplegable al final que resume las reglas de las secciones 3 a 8.

## 8. Botón Agua (vista de ingeniería de procesos)

Selecciona las estructuras indispensables para **ingresar agua a la PTAR** y la energía que las alimenta. Lodos queda fuera.

Al activarlo:
- se fija la pestaña "Todos los procesos";
- se limpia el filtro de proveedor;
- se colapsa todo;
- aparece el panel "Ruta del agua", con chips por estructura (con contador de equipos) que se pueden activar o desactivar.

Constantes de proceso:
- P1 = `01.Pretratamiento & Clarif.`
- P2 = `02.Area Norte & Lodos`
- P3 = `03.Canal 16`
- P4 = `04.Area O&M`
- P5 = `05.Progreso`
- P7 = `07.Guayacanes`

| Tramo (orden) | Por defecto | Estructuras (Proceso, CAP) |
|---|---|---|
| 1. Afluente e ingreso | Sí | P5 EB Afluente · P5 Nueva Estructura De Ingreso y Colector Afluente · P5 Trabajos De Afluente y Bypass · P3 Canal 16 · P3 Control De Caudales A Proceso Lagunas · P1 Estacion de Bombeo del Afluente · P1 Tub.Patio Impulsion_EB Ingreso_Afluente · P1 Tub.Patio Afluente_Progreso Ingreso_Afluente · P1 Tub.Patio Garzota Ingreso_Afluente · P1 Tub.Patio Mucho_Lote Ingreso_Afluente · P1 Tub.Patio Vergeles Ingreso_Afluente · P1 Tub.Patio Impulsion_EB Guayacanes |
| 2. Pretratamiento | Sí | P1 Estructura De Entrada - Pretratamiento · P1 Cribado - Rejillas · P1 Desarenadores y Control Hidraulico · P1 Clasificador De Arenas |
| 3. Tratamiento primario | Sí | P1 Tanques De Floculacion · P1 CADICAS · P1 Tanques De Clarificacion Primaria |
| 4. Energía | Sí | P5 Acometida y Subestacion Electrica 69 Kv · P2 Subestacion Principal 69Kv y Transformadores · P2 Sistema De Distribucion En Media y Baja Tension |
| 5. Opcionales | No | P1 Tanque De Almacenamiento De Agua De Servicio · P4 E.B Cloruro Ferrico · P1 Edificio De Polimeros-CCM2 · P1 Edificio De Sopladores-CCM3 · P4 Edificio de Hipoclorito de Sodio, SubE N2-CCM4 · P1 Control de Olores y CCM · P4 Centro De Control · P4 Instrumentacion y Control · P5 Centro De Control · P5 Instrumentacion y Seguridad · P5 Tanque De Almacenamiento De Combustible · P7 Linea De Impulsion Guayacanes y Repotenciacion Ebar Guayacanes |

Descripciones de cada tramo que se muestran en el panel:
- **Afluente e ingreso:** "Bombeo y conducción del agua cruda hasta la planta. Los medidores electromagnéticos van en línea: sin ellos la tubería de ingreso queda abierta."
- **Pretratamiento:** "Retención de sólidos gruesos, finos y arenas antes de los tanques; compuertas para aislar canales."
- **Tratamiento primario:** "Floculación, cámara de distribución (CADICAS) y clarificación primaria: el agua no pasa sin sus compuertas, agitadores y barredores."
- **Energía:** "Acometidas de 69 kV, transformadores, celdas, tableros y CCM que alimentan las estructuras anteriores."
- **Opcionales:** "Fuera de la selección por defecto: hacen falta para la operación continua, la dosificación química o el control remoto, pero no para que el agua ingrese."

Reglas:
- **Clave de coincidencia:** `lower(trim(Proceso) + '¦' + trim(CAP))`.
- **Orden del flujo:** `índiceTramo × 100 + índiceEstructura`; las estructuras fuera de la tabla van al final.
- **Exclusión de eléctricos de lodos** (casilla, activa por defecto): solo dentro de `P2 · Sistema De Distribucion En Media y Baja Tension`, se excluyen los equipos cuya descripción cumpla `/\b(?:CCM|Mcc)\s*-?\s*(?:8|8A|8B|12|13)\b|\bPD-(?:GAS|FoG|UTB)\b|CCM13/i`.
- **Restablecer selección:** vuelve a los tramos marcados "Sí" y activa la exclusión.
- **Agrupación con Agua y "Todos los procesos":** las bandas son los tramos (Afluente e ingreso, Pretratamiento, …).
- **Limitación:** la asignación de CCM a lodos se hace por el nombre del equipo, no por el unifilar.

## 9. Estado de la interfaz y persistencia

```ts
UI = {
  proc: '01.Pretratamiento & Clarif.', group: 'cap' | 'prov', mode: 'ex' | 'done',
  q: '', prov: '', pend: false,
  open: Set<string>,  // filas expandidas (clave grupo¦fila)
  sec:  Set<string>,  // tarjetas expandidas
  pcol: Set<string>,  // bandas de proceso expandidas
  agua: false, aSel: Set<string> /* claves Agua */, aCCM: true
}
```

- **Se guardan entre sesiones:** proc, group, mode, pend, agua, aSel y aCCM (clave `eqStatusMerinos.ui`), y la última carga del Master (clave `eqStatusMerinos.raw.v2`).
- **No se guardan:** búsqueda, proveedor ni expansiones. Al recargar todo arranca colapsado.
- **Cambios que limpian expansiones:** cambiar de pestaña o de agrupación limpia `open`, y activar Agua limpia `open` y `sec`.

## 10. Diseño

- **Tipografías:** Barlow Condensed (títulos y cifras grandes), IBM Plex Sans (cuerpo) e IBM Plex Mono (IDs).
- **Colores (modo claro):**

| Uso | Color |
|---|---|
| Fondo | `#EEF2F3` |
| Superficie | `#FFFFFF` |
| Tinta | `#14212A` |
| Acento | `#0D6B7A` |
| Fabricación | `#A86B12` |
| Flete | `#2C67A6` |
| Instalación | `#2B7F52` |
| Crítico | `#B83227` |
| Alto | `#C9701E` |
| Moderado | `#A88A12` |
| Moderado-Bajo | `#4F7F57` |

- **Modo oscuro:** completo; los tokens están en el HTML.
- **Responsive:** en móvil, margen lateral de 16 px y tablas con desplazamiento horizontal propio.

## 11. Casos de prueba (Master 18-Oct-26, filtros por defecto)

| Selección | Equipos | Fabr. ex / total (u) | Flete | Instalación | % valor D/E/F | TF mín | Retraso máx |
|---|---|---|---|---|---|---|---|
| Todos los procesos | 620 (56 CAP) | 2.390,6 / 8.728 | 973,5 | 283,2 | 85 / 73 / 36 % | −22 | +112 d |
| 01.Pretratamiento & Clarif. | 111 (24 CAP) | 202,4 / 249 | 122,6 | 82,7 | 96 / 79 / 65 % | −3 | +94 d |
| 02.Area Norte & Lodos | 253 | 1.294,8 / 5.198 | 317,8 | 88,1 | 86 / 75 / 27 % | −22 | +112 d |
| 03.Canal 16 | 16 | 26,8 / 37 | 7 | 0 | 67 / 26 / 12 % | −13 | +52 d |
| 04.Area O&M | 118 | 644,2 / 2.592 | 381,3 | 1,1 | 57 / 50 / 1 % | −22 | +69 d |
| 05.Progreso | 121 | 219,5 / 649 | 144,8 | 111,3 | 88 / 80 / 39 % | −7 | +67 d |
| 07.Guayacanes | 1 | 3 / 3 | 0 | 0 | 100 / 0 / 0 % | 25 | +7 d |
| Estructura De Entrada - Pretratamiento | 19 | 31,6 / 39 | 5 | 0 | 91 / 11 / 0 % | 12 | +94 d |
| ↳ solo proveedor CMO | 13 | 26,1 / 29 | 0 | 0 | 90 / 0 / 0 % | 12 | +11 d |
| Botón Agua (selección por defecto) | 349 (22 CAP) | 1.366,2 / 5.332 | 385,6 | 180,3 | 88 / 73 / 36 % | −22 | +94 d |

Otros controles:
- 869 equipos en total, de los cuales 249 están pendientes de regularizar (WBS D).
- Con Cantidad 0 y sin estar pendientes: 0 equipos.
- 21 actividades sin estado en la columna p6.

En modo "Partidas terminadas" la cantidad de una etapa cuenta completa si P6 dice Completed, aunque la Cantidad Ex sea menor. Por eso en 04.Area O&M las terminadas en fabricación (930 u) superan la Cantidad Ex (644,2 u). Es el comportamiento esperado.

## 12. Limitaciones conocidas

- La marca de fecha real se infiere del estado, porque el Master no trae la "A" de P6.
- Las cifras grandes de los KPI solo usan la unidad `u`; las demás unidades aparecen como texto secundario.
- La selección Agua y la exclusión de CCM de lodos son una configuración fija. Si cambian los nombres de CAP en el Master, hay que actualizar la tabla de la sección 8.
