// Endpoints de IA (análisis del cronograma, equipos y reporte ejecutivo).
// Los prompts son los originales; el proveedor del modelo vive en llm.ts.
import { generateText } from "./llm";
import type { Env } from "./env";

export interface LegacyReq { body: any }
export interface LegacyRes {
  status(code: number): LegacyRes;
  json(data: unknown): void;
}

export async function analyze(req: LegacyReq, res: LegacyRes, env: Env) {
    try {
      const { stats, sampleActivities, customPrompt } = req.body;

      // Build context summary for the model
      const statsText = stats
        ? `Estado del Cronograma:
- Total Actividades: ${stats.total || 0}
- Finalizadas: ${stats.completed || 0} (Completo: ${stats.pctCompleted || "0"}%)
- En Curso / Iniciados: ${stats.started || 0}
- No Iniciados: ${stats.notStarted || 0}
- Retrasadas o Críticas: ${stats.delayed || 0}`
        : "No stats provided";

      const limitSample = (sampleActivities || []).slice(0, 50);
      const activitiesSummaryText = limitSample.length > 0 
        ? limitSample.map((act: any) => {
            return `- WBS [${act.wbs || "N/A"}]: ${act.descripcion || act.desc || "Sin descripción"} | Duración: ${act.duracion || act.duration || "N/A"}d | Inicio: ${act.inicio || "N/A"} | Fin: ${act.fin || "N/A"} | Status: ${act.p6 || act.status || "N/A"} | Total Float (Holgura): ${act.totalFloat !== undefined ? act.totalFloat : "N/A"}`;
          }).join("\n")
        : "No activities provided";

      const systemInstruction = `Eres un Ingeniero Experto en Control de Proyectos y Planificación (Project Controls Specialist) con certificación PMI-SP u Oracle Primavera P6.
Tu objetivo es analizar bases de datos de cronogramas y proveer revisiones inteligentes de alto nivel.
Recibirás estadísticas de avance y una muestra de actividades (muchas de ellas con desviaciones o retrasos).
Debes responder en formato Markdown estricto usando títulos, listas y negritas bien claras.

Sé constructivo, técnico, objetivo y orienta tus sugerencias a:
1. Identificar rutas críticas posibles o desviaciones en cascada.
2. Analizar el impacto de holgura total (Total Float) negativa o escasa.
3. Brindar recomendaciones realistas de aceleración (como Fast-Tracking, Crashing de recursos o resecuenciación de actividades lógicas).
4. No menciones el formato de transporte JSON ni detalles técnicos de la API. Dirígete directamente al analista de planificación.`;

      let userPrompt = `A continuación tienes los detalles actuales del cronograma para su análisis:

${statsText}

Muestra representativa de partidas o actividades seleccionadas para análisis minucioso:
${activitiesSummaryText}

`;

      if (customPrompt) {
        userPrompt += `\nConsulta específica del usuario:\n${customPrompt}\n\nPor favor, responde detallando la consulta basándote en la información otorgada anteriormente.`;
      } else {
        userPrompt += `\nGenera un análisis de salud general del proyecto, identifica los mayores cuellos de botella del cronograma (analizando las sub-partidas prioritarias) y propón un plan de acción concreto de 3 pasos clave para recuperar la holgura en las partidas críticas.`;
      }

      const text = await generateText(env, { system: systemInstruction, prompt: userPrompt, temperature: 0.7 });

      res.json({
        analysis: text,
      });
    } catch (error: any) {
      console.error("Error calling AI:", error);
      const errorStr = `${typeof error === "object" ? JSON.stringify(error) : String(error)} ${error?.message ?? ""}`;
      let errorMessage = error.message || "Error interno al comunicarse con el motor de Inteligencia Artificial.";
      let errorCode = "AI_ERROR";

      if (errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("high demand") || errorStr.includes("temporary")) {
        errorCode = "AI_HIGH_DEMAND";
        errorMessage = "El servicio de Inteligencia Artificial está experimentando una demanda inusualmente alta en este momento (Error 503). Por favor, espera unos segundos e intenta enviar de nuevo tu consulta.";
      } else if (errorStr.includes("429") || errorStr.includes("Resource has been exhausted") || errorStr.includes("rate limit")) {
        errorCode = "AI_RATE_LIMIT";
        errorMessage = "Se ha alcanzado el límite de consultas permitidas de Inteligencia en este momento (Error 429). Por favor, intenta de nuevo en unos instantes.";
      }

      res.status(500).json({
        error: errorCode,
        message: errorMessage
      });
    }
  }

export async function equipmentAnalyze(req: LegacyReq, res: LegacyRes, env: Env) {
    try {
      const { plainTextReport, history, userQuestion } = req.body;

      const systemInstruction = `Eres un Ingeniero Senior de Control de Proyectos y Especialista en Gestión de Equipos e Instrumentación a Demanda en proyectos industriales complejos.
Tu objetivo es responder consultas técnicas de un analista o gerente basándote en la base de datos estructurada de equipos suministrada.
El reporte de equipos que recibes incluye agrupaciones por contratista, paquetes, WBS limpia, cantidades totales con sus unidades correspondientes (como u, glb) y programación de fechas.

Por favor, responde con las siguientes directrices:
1. Sé extremadamente analítico, preciso y estructurado en tus respuestas. Usa Markdown claro (listas, tablas, negritas).
2. Si te preguntan por totales o unidades, haz los cálculos correctos basados en la información provista en el reporte.
3. Si identificas riesgos (por ejemplo, frentes "Por Contratar" que no tienen un contratista asignado o paquetes con fechas críticas), destácalos constructivamente.
4. Mantén una comunicación profesional, directa y de alto valor de ingeniería. Evita hablar de tecnicismos del formato de datos (JSON, variables de código, etc.). Dirígete directamente al especialista que te consulta.`;

      let prompt = `REPORTE DE EQUIPOS (BASE DE DATOS DE CONTEXTO):\n${plainTextReport || "No hay datos de equipos disponibles."}\n\n`;
      
      if (history && history.length > 0) {
        prompt += `HISTORIAL DE LA CONVERSACIÓN:\n`;
        const activeHistory = history.slice(-10); // keep last 10 turns to avoid token overflow
        activeHistory.forEach((msg: any) => {
          const sender = msg.role === 'user' ? 'Usuario' : 'Asistente';
          prompt += `${sender}: ${msg.content}\n`;
        });
      }
      
      prompt += `\nNueva consulta del usuario: ${userQuestion}\n`;

      const text = await generateText(env, { system: systemInstruction, prompt: prompt, temperature: 0.7 });

      res.json({
        answer: text,
      });
    } catch (error: any) {
      console.error("Error in equipment analysis:", error);
      const errorStr = `${typeof error === "object" ? JSON.stringify(error) : String(error)} ${error?.message ?? ""}`;
      let errorMessage = error.message || "Error interno al comunicarse con el motor de Inteligencia Artificial.";
      let errorCode = "AI_ERROR";

      if (errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("high demand") || errorStr.includes("temporary")) {
        errorCode = "AI_HIGH_DEMAND";
        errorMessage = "El servicio de Inteligencia Artificial está experimentando una demanda inusualmente alta en este momento (Error 503). Por favor, espera unos segundos e intenta enviar de nuevo tu consulta.";
      } else if (errorStr.includes("429") || errorStr.includes("Resource has been exhausted") || errorStr.includes("rate limit")) {
        errorCode = "AI_RATE_LIMIT";
        errorMessage = "Se ha alcanzado el límite de consultas permitidas de Inteligencia en este momento (Error 429). Por favor, intenta de nuevo en unos instantes.";
      }

      res.status(500).json({
        error: errorCode,
        message: errorMessage
      });
    }
  }

export async function cronoReport(req: LegacyReq, res: LegacyRes, env: Env) {
    try {
      const { projectSummary, areaData, retrasoEconomicoTipologia, equipamientoPorSCAP, dataDate } = req.body;

      const systemInstruction = `Eres un Director Especialista de Control de Proyectos y Planificación de Obras Industriales y Civiles (PMI-SP / Primavera P6 Specialist).
Tu objetivo es redactar un Reporte Ejecutivo y Operativo de Inteligencia Artificial agrupado ESTRUCTURADAMENTE POR ÁREA (Tipología / Sector / Frente de Trabajo).

El reporte debe incluir las siguientes secciones obligatorias en formato Markdown limpio y profesional:
1. 📊 **Resumen Ejecutivo**: Breve síntesis del estado general de la obra al ${dataDate || 'día de hoy'}.
2. 💸 **Análisis de Retraso Económico por Tipología**:
   - Presenta un análisis económico detallado de cada Tipología (Venta Planificada vs Venta Ejecutada vs Variación Económica).
   - OBLIGATORIO: Presenta este resumen de tipologías en una TABLA MARKDOWN bonita y limpia.
   - **ÉNFASIS ESPECIAL EN VARIACIONES NEGATIVAS SUPERIORES A LOS 10.000 USD**: Identifica, resalta en negrita y analiza en detalle todas las Tipologías y partidas específicas cuya variación negativa sea mayor a -$10,000 USD (desviaciones o pérdidas financieras superiores a 10.000 USD).
   - Explica el impacto de estas desviaciones mayores a $10.000 USD en la rentabilidad y el flujo de caja del proyecto.
3. 🚨 **Actividades Retrasadas por Área**:
   - Analiza las actividades que presentan retraso físico a día de hoy (que debían haber iniciado y no iniciaron, o debían terminar y no terminaron).
   - Detalla por cada Área el número de partidas retrasadas, cuáles son las más críticas y el impacto en días de atraso.
4. 📅 **Actividades Programadas para las Próximas 4 Semanas por Área**:
   - REGLA INDISPENSABLE: Presenta OBLIGATORIAMENTE el resumen cuantitativo de actividades programadas para las próximas 4 semanas por cada Área/Sector en una TABLA MARKDOWN O LISTA ESTRUCTURADA con la cantidad por Área:
     | Área / Sector | Actividades Programadas |
     | :--- | :---: |
     | Centro de Control | 18 actividades |
     | Tuberia Patio | 12 actividades |
   - Esta información se renderizará automáticamente en la interfaz como un Gráfico de Barras Horizontales Azules estilo Power BI.
   - A continuación, detalla los compromisos críticos de entrega y recursos necesarios por Área para los próximos 28 días.
5. 💡 **Recomendaciones Operativas y Plan de Mitigación**:
   - 3 a 5 acciones prioritarias para recuperar holgura, frenar las pérdidas económicas > 10.000 USD, asegurar la instalación oportuna de equipos (actividades F) y garantizar el cumplimiento del plan en las próximas 4 semanas.
6. ⚙️ **Análisis de Cantidad de Equipamiento e Instrumentación por SCAP (Pendientes por Instalar)**:
   - Presenta el análisis de volumetría de equipos e instrumentación PENDIENTES DE INSTALAR agrupado PRIMERO por Tipo ('Equipo' vs 'Instrumentación') y LUEGO por SCAP (excluyendo actividades completadas/Completed, excluyendo rubros de Partida D y excluyendo filas vacías o SCAPs sin pendencia real).
   - REGLA INDISPENSABLE DE FORMATO DE TABLA BONITA: Esta sección DEBE presentarse como una TABLA MARKDOWN ESTÁNDAR LIMPIA Y ELEGANTE con exactamente las siguientes 5 columnas:
     | Tipo | SCAP | Pendiente | Partidas | Avance |
     | :--- | :--- | :---: | :---: | :---: |
   - CADA FILA DE LA TABLA DEBE IR EN SU PROPIA LÍNEA SEPARADA POR UN SALTO DE LÍNEA. QUEDA ESTRICTAMENTE PROHIBIDO COLOCAR MÚLTIPLES FILAS EN LA MISMA LÍNEA SEPARADAS POR '||'.
   - Estructura requerida para cada fila:
     * **Tipo**: Tipo de elemento ('Equipo' o 'Instrumentación')
     * **SCAP**: Nombre del SCAP o subsistema
     * **Pendiente**: Cantidad total con unidad pendiente de instalar (ej. 150 pcs, 24 u)
     * **Partidas**: Número de partidas o actividades F asociadas (ej. 12 partidas)
     * **Avance**: Porcentaje de avance acumulado o promedio (ej. 45.0%)
   - Agrega un breve párrafo resumen de 2 líneas al final destacando el total general de equipos e instrumentos pendientes por instalar.

REGLA CRÍTICA PARA TABLAS MARKDOWN:
Toda tabla Markdown DEBE utilizar saltos de línea individuales (\n) entre cada fila. NUNCA concatenes las filas de una tabla en una sola línea continua ni uses '||'.
Ejemplo obligatorio de tabla bien formateada:
| Tipo | SCAP | Pendiente | Partidas | Avance |
| :--- | :--- | :---: | :---: | :---: |
| Equipo | **Centro de Control** | 36,970.41 m2, u, m | 23 partidas | 0.0% |
| Instrumentación | **Instrumentos** | 1,313.00 u | 70 partidas | 0.0% |

Usa títulos claros, viñetas, negritas y tablas Markdown estructuradas. Directo al grano, analítico y profesional.`;

      const userPrompt = `A continuación tienes la información estructurada del cronograma de obra:

DATOS GENERALES DE LA OBRA (Fecha de Análisis: ${dataDate || 'Hoy'}):
- Total de Actividades Evaluadas: ${projectSummary?.total || 0}
- Total de Actividades Retrasadas: ${projectSummary?.totalDelayed || 0}
- Total de Actividades Próximas (Próximas 4 semanas): ${projectSummary?.totalUpcoming || 0}
- Total de Partidas con Desviación Negativa Crítica (> 10.000 USD): ${projectSummary?.totalItemsCriticos10k || 0}
- Monto Total de Desviación Crítica (> 10.000 USD): $${(projectSummary?.totalMontoCritico10kUSD || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
- Total Equipos e Instrumentación Pendientes por Instalar (Activity ID con 'F', excluyendo Completadas): ${projectSummary?.totalEquiposAInstalarF || 0}

DESGLOSE DE CANTIDAD DE EQUIPAMIENTO E INSTRUMENTACIÓN PENDIENTES POR SCAP (Tipo 'Equipo/Instrumentación', Activity ID con 'F', Estado NO Completado y Excluyendo Partida D):
${JSON.stringify(equipamientoPorSCAP, null, 2)}

DESGLOSE DE RETRASO ECONÓMICO POR TIPOLOGÍA (Con Énfasis en Variaciones Negativas > $10.000 USD):
${JSON.stringify(retrasoEconomicoTipologia, null, 2)}

ACTIVIDADES DETALLADAS Y AGRUPADAS POR ÁREA:
${JSON.stringify(areaData, null, 2)}

Por favor, genera el Reporte Analítico de Inteligencia Artificial por Área, Tipología y Equipamiento por SCAP según la estructura requerida.`;

      const text = await generateText(env, { system: systemInstruction, prompt: userPrompt, temperature: 0.6 });

      res.json({
        markdown: text,
        generatedAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error generating crono report:", error);
      const errorStr = `${typeof error === "object" ? JSON.stringify(error) : String(error)} ${error?.message ?? ""}`;
      let errorMessage = error.message || "Error interno al comunicarse con el motor de Inteligencia Artificial.";
      let errorCode = "AI_ERROR";

      if (errorStr.includes("503") || errorStr.includes("UNAVAILABLE") || errorStr.includes("high demand")) {
        errorCode = "AI_HIGH_DEMAND";
        errorMessage = "El servicio de Inteligencia Artificial está experimentando alta demanda (Error 503). Por favor intenta de nuevo en unos segundos.";
      } else if (errorStr.includes("429") || errorStr.includes("Resource has been exhausted")) {
        errorCode = "AI_RATE_LIMIT";
        errorMessage = "Límite de consultas alcanzado (Error 429). Por favor intenta en unos momentos.";
      }

      res.status(500).json({
        error: errorCode,
        message: errorMessage
      });
    }
  }
