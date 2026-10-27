# Estado de Equipos PTAR Merinos: pasos de implementación

Guía para integrar el aplicativo en una web app existente. Va acompañada de:
- `estado_equipos_especificacion.md`: reglas y cálculos. Es la fuente de verdad.
- `estado_equipos.html`: implementación de referencia que funciona, con datos embebidos.
- `estado_equipos_codigo.html`: el mismo código sin datos, más liviano para leer.

---

## Prompt sugerido para el asistente de IA

> Vas a implementar el módulo "Estado de Equipos PTAR Merinos" dentro de mi web app. Te adjunto tres archivos:
> 1. `estado_equipos_especificacion.md`: la especificación. Es la fuente de verdad para datos, cálculos e interfaz.
> 2. `estado_equipos_pasos_implementacion.md`: los pasos que debes seguir, en orden.
> 3. `estado_equipos_codigo.html`: implementación de referencia en HTML + JavaScript. Úsala para resolver dudas de comportamiento; no la copies tal cual.
>
> Reglas:
> - La única fuente de datos es `2. Master.xlsx`, pestaña `cdo`, encabezados en la fila 2. Busca las columnas por nombre.
> - Separa la lógica en funciones puras (lectura → modelo → filtros → agregación) y escribe pruebas con las cifras de la sección 11 de la especificación.
> - Respeta los textos en español de la interfaz.
> - Antes de escribir código, dime qué framework, router, gestor de estado y estilos usa mi proyecto, y propón la estructura de archivos. Luego implementa fase por fase y espera mi confirmación al final de cada una.

---

## Fase 0. Preparación

1. **Identificar el stack de la web app:** framework, TypeScript o no, estilos (Tailwind, CSS modules…) y si ya existe un backend o una base de datos.
2. **Decidir de dónde se leen los datos:**
   - **Opción A, archivo en el navegador** (igual que la referencia): el usuario sube `2. Master.xlsx` y se procesa en el cliente con SheetJS. No requiere backend.
   - **Opción B, datos ya sincronizados:** si la web app ya publica la pestaña `cdo` en una base de datos (por ejemplo Firestore), leer de ahí las filas con `Grupos` 02/03/04. Hace falta que la sincronización incluya todas las columnas de la sección 2 de la especificación, incluidas `p6`, `Start`, `Finish`, `blFinish` y `Float`.
   - Se puede empezar con A y migrar a B sin tocar el resto, si la lectura queda aislada en un adaptador (Fase 1).
3. **Instalar dependencias:** `xlsx` (SheetJS, versión 0.18.5 o compatible) para la opción A. No se necesita nada más; los gráficos son barras hechas con CSS.
4. **Estructura sugerida** (adaptar al proyecto):

```
src/modules/estado-equipos/
  data/readMaster.ts        # adaptador: archivo o BD → filas crudas
  domain/types.ts           # Stage, Equipo, Agg, UIState
  domain/buildModel.ts      # filas → equipos
  domain/aggregate.ts       # agg, fracs, stateOf, riskOf, sentence
  domain/filters.ts         # universe, filtered
  domain/agua.ts            # configuración Agua, akey, ADEF, sludgeElec
  domain/format.ts          # fq, pc, fd, dd, natCmp
  ui/EstadoEquiposPage.tsx  # contenedor
  ui/Header.tsx  ui/UploadPanel.tsx  ui/ProcessTabs.tsx  ui/Kpis.tsx
  ui/Controls.tsx  ui/AguaPanel.tsx  ui/GroupList.tsx  ui/CapCard.tsx
  ui/ItemsTable.tsx  ui/HowItWorks.tsx
  styles/estado-equipos.css
  __tests__/domain.test.ts
```

## Fase 1. Lectura del Master (`readMaster`)

1. Abrir el libro y tomar la hoja `cdo`; si no existe, `CDO`. Con SheetJS conviene leer solo esa hoja y sin estilos:

```ts
XLSX.read(buf, { type: 'array', sheets: ['cdo', 'CDO'],
  cellFormula: false, cellHTML: false, cellText: false, cellStyles: false })
```

2. **Encontrar la fila de encabezados:** recorrer las primeras 8 filas y quedarse con la primera que contenga todos estos nombres (recortados):

```
Activity ID, Activity Name, Unidad, Cantidad, Venta, SubC, Contrato, p6,
Ubicacion, Proceso, CAP, SCAP, Unit, Obs, Grupos, % Ex, Cantidad Ex, Venta Ex,
Start, Finish, blFinish, Float, Componente
```

   Si no se encuentra, mostrar el error: "En 2. Master no encontré la pestaña cdo con las columnas …".

3. **Semana de corte:** tomar las últimas 12 columnas cuyo encabezado empiece por `V-`, sumar el valor absoluto de cada una en todas las filas, y quedarse con la última cuya suma sea > 1000. Su etiqueta sin el `V-` (por ejemplo `18-Oct-26`) es la semana de corte.

4. **Recorrer las filas:** conservar solo las que tengan `Grupos` empezando por `02.`, `03.` o `04.` y que contengan `Procura_Eq`, `Flete_Eq` o `Precom_Eq`. Para cada una, emitir una fila cruda con este orden:

```ts
type RawRow = [id, name, und, qty, venta, subc, contrato, p6, ubic, proc, cap, scap,
               unit, obs, grupo2 /* '02'|'03'|'04' */, pex, cex, vex,
               start /*ISO*/, finish /*ISO*/, blFinish /*ISO*/, float, componente]
```

   - (new v31) Además, guardar en `p6Ids` todos los Activity ID que terminen en `.p6`, y conservar también las filas cuyo `SCAP` contenga "válvula" (sin tilde o con tilde, sin distinguir mayúsculas) y cuyo `Grupos` NO empiece por 01–04: con `grupo2 = 'VP'` si el ID termina en `.p6` y `'V'` en caso contrario.
   - Los números van solo si la celda es numérica; si no, `null`.
   - Las fechas: si la celda es numérica, es un serial de Excel y se convierte a ISO (`XLSX.SSF.parse_date_code`, o 1899-12-30 + n días). Si es texto `dd-mm-yy` o `dd-mm-yyyy`, se convierte. En cualquier otro caso, `null`.

5. Si no queda ninguna fila: "El Master no tiene partidas en 02.Procura_Eq., 03.Flete_Eq. o 04.Precom_Eq. en la columna Grupos."

6. Devolver `{ rows, p6Ids, semana, nombreArchivo }`.

7. **Rendimiento:** la hoja tiene unas 15.800 filas y más de 500 columnas. Leerla en un Web Worker si la interfaz se congela. La referencia lo hace en el hilo principal y tarda unos segundos.

## Fase 2. Modelo (`buildModel`)

Implementar exactamente la sección 3 de la especificación:
1. Agrupar por `base`. La etapa sale del grupo (02→D, 03→E, 04→F).
2. Aplicar `trim` a los textos, y las reglas de `ex`, `done`, `startA`/`finA` y `status`.
3. La etapa D manda en cantidad, unidad, CAP y proceso.
4. Rellenar las etapas faltantes. Calcular `desc`, `prov`, `inst` y `pend`.
5. (new v31) **Válvulas S+I:** para cada fila `'V'`, buscar el ancestro `.p6` más cercano (quitar segmentos del ID por la derecha y probar `<prefijo>.p6` contra `p6Ids`). Si ese ancestro es una fila `'VP'`, crear un equipo con `base = id`, `valv = <id .p6>`, cantidad y Cantidad Ex de la fila, estado de la fila (o de la `.p6` si falta o dice "p6"), fechas/Float de la fila o de la `.p6`, y el mismo objeto de etapa copiado en D, E y F. `prov = SubC` de la fila. `desc` = nombre sin "Suministro e instalación (y prueba) de" ni ", para items del listado maestro…". Si no hay ancestro de válvulas, se descarta.
6. Ordenar por `base` con orden natural:

```ts
function natCmp(a: string, b: string) {
  const A = a.split(/[.\-]/), B = b.split(/[.\-]/);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const x = A[i] ?? '', y = B[i] ?? '';
    const nx = +x, ny = +y;
    if (!isNaN(nx) && !isNaN(ny) && x !== '' && y !== '') { if (nx !== ny) return nx - ny; }
    else if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}
```

6. **Prueba:** con el Master del 18-Oct-26 deben salir 869 equipos, 249 con `pend`.
7. Marcar `isCable` (sección 4 de la especificación) y dejar esas partidas fuera del universo. Deben ser 43.

## Fase 3. Agregación y reglas de lectura

1. `agg(list)` según la sección 5. Cuidar estos detalles:
   - las cantidades se suman por unidad;
   - `dn` suma la `qty` del equipo cuando la etapa está `done`;
   - `tf` ignora las etapas terminadas y los Float ≥ 400;
   - `maxLate` solo cuenta equipos con F no terminada.
2. `fracs`, `stateOf`, `riskOf` y la frase resumen, según la sección 6.
3. **Formato:**
   - Cantidades: locale `es-EC`, una decimal solo si hace falta (2.390,6 · 8.728).
   - Porcentajes: enteros con espacio (`85 %`).
   - Fechas: `dd-mmm-aa` con meses en español en minúscula (`18-oct-26`).
   - Días: `(Date.UTC(a) − Date.UTC(b)) / 86 400 000`, redondeado.
4. **Prueba:** reproducir la tabla de la sección 11 de la especificación.

## Fase 4. Filtros y estado de la interfaz

1. Definir el estado `UI` de la sección 9 en el gestor de estado del proyecto (useState/useReducer, Zustand, Pinia…).
2. `universe()` y `filtered()` según la sección 4, sin cables ni conductores. La búsqueda va con un retardo de unos 180 ms.
3. **Persistencia:** guardar `proc`, `group`, `mode`, `pend`, `agua`, `aSel` y `aCCM`, y la última carga del Master.
   - Con localStorage, envolver toda lectura y escritura en try/catch.
   - Si la web app tiene usuarios, conviene guardarlo en su perfil.
4. **Efectos colaterales:**
   - cambiar de pestaña o de agrupación limpia las filas abiertas;
   - activar Agua fija `proc='*'`, limpia el proveedor y colapsa todo;
   - si el proceso o el proveedor guardado ya no existe en los datos, volver al primero o a "todos".

## Fase 5. Componentes de interfaz

Construir en este orden y verificar cada uno contra `estado_equipos.html` abierto lado a lado:

1. **Header:** título, línea de fuente ("Master · archivo · ejecución hasta …") y los botones *Expandir/Colapsar tarjetas*, *Limpiar filtros* (sección 7.1 de la especificación) y *Actualizar Master*.
   - El texto del primer botón depende de si hay alguna tarjeta o banda abierta. Al pulsarlo, abre todas las tarjetas y bandas visibles o las cierra todas.
2. **UploadPanel** (oculto hasta pulsar *Actualizar Master*): selector de archivo, *Procesar*, *Volver a la carga original* y mensaje de estado.
3. **ProcessTabs:** "Todos los procesos" + procesos ordenados, cada uno con contador (partidas y estructuras en dos líneas) y tres minibarras de % por valor. Se acomodan en una cuadrícula `repeat(auto-fit, minmax(118px, 1fr))` que baja de línea sin desplazamiento lateral; los nombres largos se parten.
4. **TypeFilter** (sección 7.3b): botones por Componente entre las pestañas y las tarjetas, con Ctrl + clic para combinar. Debajo va **ScapFilter** (sección 7.3c), el mismo componente aplicado a SCAP, con un límite de 7 botones sin filtros activos y "+N más", y luego **SubcFilter** (v30), el mismo componente aplicado a SubC (proveedor `prov`) con las mismas reglas. Conviene hacer un solo componente `ChipFilter` parametrizado (campo, etiqueta, orden, límite).
5. **Kpis:** las 4 tarjetas de la sección 7.4.
6. **Controls:** Agua, Agrupar por, Cantidad, búsqueda, proveedor y casilla de pendientes.
7. **AguaPanel** (Fase 6).
8. **GroupList:**
   - Agrupar con las claves de la sección 7.6.
   - Si `group==='cap'` y `proc==='*'`, envolver las tarjetas en bandas: por proceso, o por tramo del agua si Agua está activo. Las bandas arrancan colapsadas (el set `pcol` guarda las abiertas).
   - Ordenar según la sección 7.6.
9. **CapCard:** colapsada por defecto (el set `sec` guarda las abiertas). Encabezado clicable con los % Fabr./Flete/Instalación y el botón *Copiar resumen*, que copia "En «título»:" más una línea por fila. La tabla interna se muestra solo si la tarjeta está abierta.
10. **ItemsTable:** detalle por equipo al abrir una fila. La fila se abre con clic, Enter o Espacio y es enfocable.
11. **HowItWorks:** bloque desplegable con las reglas resumidas.
12. **Accesibilidad:**
    - `aria-pressed` en los botones de alternar, `aria-expanded` en tarjetas, bandas y filas, `role="tab"` y `aria-selected` en las pestañas;
    - foco visible;
    - no depender solo del color: los estados llevan texto.

## Fase 6. Botón Agua

1. Pasar la configuración `AGUA` de la sección 8 a `domain/agua.ts`, tal cual: tramos, descripciones, pares (Proceso, CAP) y el indicador "por defecto".
2. Implementar:
   - `akey(proc, cap)`;
   - `AORDER` (tramo × 100 + posición) y `ATRAMO` (clave → nombre del tramo);
   - `ADEF()` (claves de los tramos por defecto);
   - `sludgeElec(equipo)` con la regex de la especificación, aplicada solo en `P2 · Sistema De Distribucion En Media y Baja Tension`.
3. **Panel:**
   - título "Ruta del agua" y "N estructuras seleccionadas · toca una para quitarla o agregarla";
   - una columna por tramo con su descripción y chips de estructura. Cada chip muestra el contador de equipos y la etiqueta "Progreso" si el proceso es `05.Progreso`;
   - la casilla de exclusión de CCM de lodos y el botón *Restablecer selección*.
4. **Prueba:** con la selección por defecto deben quedar 349 equipos en 22 estructuras.

## Fase 7. Estilos

1. Llevar los tokens de color de la sección 10 (claro y oscuro) a variables CSS, o al tema del proyecto si usa Tailwind o un design system.
2. Colores fijos por etapa: Fabricación ámbar, Flete azul, Instalación verde. Se repiten en KPIs, barras, chips y puntos.
3. Tipografías: Barlow Condensed, IBM Plex Sans e IBM Plex Mono (Google Fonts), o las equivalentes de la web app.
4. Paneles que se ocultan (carga, Agua, resumen): si se ocultan con el atributo `hidden` y además tienen `display:grid`/`flex`, añadir `[hidden]{display:none!important}`. Sin esa regla, el panel queda visible.
5. Responsive:
   - las tablas tienen `min-width` y desplazamiento propio;
   - en ≤ 640 px los % de la tarjeta pasan a ocupar todo el ancho;
   - sin desplazamiento horizontal de la página.

## Fase 8. Pruebas

1. **Unitarias del dominio**, con un Master real o un extracto: las cifras de la sección 11 deben coincidir exactamente.
2. **Casos borde:**
   - equipo sin etapa D;
   - Cantidad Ex vacía con % Ex;
   - Float 500 en una etapa terminada;
   - celda `p6` con el literal `'p6'`;
   - proveedor con espacios al final;
   - unidad distinta de `u`.
3. **Pruebas de interfaz:**
   - todo arranca colapsado;
   - "Expandir tarjetas" abre bandas y tarjetas;
   - el modo "Partidas terminadas" oculta los equipos sin ninguna etapa terminada;
   - Agua fuerza "Todos los procesos" y agrupa por tramo;
   - la búsqueda "CMO" dentro de 01.Pretratamiento devuelve los equipos de CMO;
   - volver a cargar el Master reemplaza los datos y conserva los filtros.
4. **Comparación visual** con `estado_equipos.html` en claro, oscuro y móvil.

## Fase 9. Despliegue y operación semanal

1. Cada semana, tras el cierre, subir el `2. Master.xlsx` nuevo con *Actualizar Master* (opción A) o dejar que la sincronización lo publique (opción B).
2. Verificar que la línea de fuente muestre la semana de corte esperada.
3. Si cambian los nombres de CAP o de proceso en el Master, revisar la configuración Agua: las estructuras que dejen de coincidir aparecerán con contador 0 en el panel.
