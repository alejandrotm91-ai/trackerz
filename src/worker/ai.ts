// Endpoints de IA (análisis del cronograma, equipos y reporte ejecutivo).
// Los prompts son los originales; el proveedor del modelo vive en llm.ts.
import Anthropic from "@anthropic-ai/sdk";
import { generateText, MODEL_REPORTE } from "./llm";
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

      const text = await generateText(env, { system: systemInstruction, prompt: userPrompt });

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

      const text = await generateText(env, { system: systemInstruction, prompt: prompt });

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

const texto = { type: "string" };
const lista = (items: object) => ({ type: "array", items });
const objeto = (properties: Record<string, object>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** Esquema fijo del análisis: el reporte siempre tiene las mismas secciones. */
const ESQUEMA_ANALISIS = objeto({
  estadoGeneral: { type: "string", enum: ["En control", "Requiere atención", "Crítico"] },
  resumenEjecutivo: texto,
  puntosClave: lista(texto),
  comparacionAnterior: texto,
  economico: objeto({ analisis: texto, hallazgos: lista(texto) }),
  retrasos: objeto({ analisis: texto, areasCriticas: lista(objeto({ area: texto, comentario: texto })) }),
  proximas: objeto({ analisis: texto, compromisos: lista(objeto({ area: texto, compromiso: texto })) }),
  equipamiento: objeto({ analisis: texto }),
  recomendaciones: lista(objeto({
    prioridad: { type: "string", enum: ["Alta", "Media", "Baja"] },
    accion: texto,
    area: texto,
    plazo: texto,
  })),
});

const SISTEMA_REPORTE = `Eres el Director de Control de Proyectos de una obra industrial y civil (planta de tratamiento de aguas residuales). Escribes el análisis del reporte estándar de Inteligencia del cronograma.

La aplicación ya calcula y muestra todas las cifras y tablas. Tu trabajo es interpretarlas: explicar qué significan, qué cambió, dónde está el riesgo y qué hacer. Devuelves solo el análisis, con la estructura indicada.

Reglas:
- Usa únicamente los datos recibidos. No inventes cifras, actividades, áreas ni fechas. Si un dato no está, no lo supongas.
- Cita las cifras tal como vienen. Montos sin el símbolo $, en millones con dos decimales (p. ej. 2.35M) o con separador de miles (p. ej. 845,120).
- Una variación negativa significa que lo ejecutado va por debajo de lo planificado (atraso económico).
- "ejecutivo" trae lo esencial del proyecto: avance de obra (ejecutado sobre el monto del contrato), avance de certificación (planillado sobre el contrato de la planilla), montos por ejecutar y por certificar, excedentes (en obra, negativo = ahorro frente al contrato; en certificación, lo planillado por encima de lo contratado), la última certificación, el avance por componente y el avance de equipos por área en sus tres etapas (fabricación, flete e instalación, en % del valor).
- resumenEjecutivo abre con el avance de obra y de certificación, y la brecha entre ambos; puntosClave incluye el estado de los equipos (la etapa más rezagada y las áreas críticas).
- Escribe en español, en tono profesional y directo, sin relleno ni frases genéricas. Prosa sin Markdown, sin viñetas dentro de los textos y sin emojis.
- Longitudes: resumenEjecutivo de 3 a 5 frases; puntosClave de 3 a 5; hallazgos de 2 a 5; areasCriticas de hasta 5 áreas (las de mayor riesgo); compromisos de hasta 6; recomendaciones de 3 a 5, ordenadas de mayor a menor prioridad, cada una concreta y verificable, con área responsable y plazo (p. ej. "2 semanas").
- En "area" usa exactamente los nombres de área o tipología que aparecen en los datos (o "General" si aplica a toda la obra).
- estadoGeneral: "En control" si la obra va según lo planificado; "Requiere atención" si hay desvíos que se pueden corregir; "Crítico" si los desvíos comprometen plazos o costo.
- comparacionAnterior: compara con los indicadores del reporte anterior (qué mejoró y qué empeoró, con cifras). Si no hay reporte anterior, escribe "Primer reporte: no hay un reporte anterior para comparar."`;

/** Reporte estándar del botón "Inteligencia": la app manda las cifras y Claude devuelve el análisis. */
export async function cronoReport(req: LegacyReq, res: LegacyRes, env: Env) {
  try {
    const { datos, contexto, anterior } = req.body || {};
    if (!datos?.kpis) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Faltan los datos del reporte. Recarga la página e intenta de nuevo." });
      return;
    }

    const prompt = `Fecha de corte: ${datos.fechaCorte}

CIFRAS DEL REPORTE (calculadas por la aplicación, se muestran tal cual):
${JSON.stringify(datos)}

REPORTE ANTERIOR:
${anterior ? JSON.stringify(anterior) : "No hay reporte anterior."}

DETALLE DE APOYO (actividades más atrasadas, próximas 4 semanas y equipos por SCAP):
${JSON.stringify(contexto || {})}

Escribe el análisis del reporte estándar con estos datos.`;

    const text = await generateText(env, {
      system: SISTEMA_REPORTE,
      prompt,
      model: MODEL_REPORTE,
      effort: "high",
      esquema: ESQUEMA_ANALISIS,
    });

    res.json({
      analisis: JSON.parse(text),
      modelo: MODEL_REPORTE,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Error generando el reporte de Inteligencia:", error);
    let errorCode = "AI_ERROR";
    let errorMessage = error?.message || "Error interno al comunicarse con la Inteligencia Artificial.";
    if (error instanceof Anthropic.AuthenticationError) {
      errorCode = "AI_AUTH";
      errorMessage = "La clave de la API de Anthropic no es válida. Revisa el secreto ANTHROPIC_API_KEY en Cloudflare.";
    } else if (error instanceof Anthropic.RateLimitError) {
      errorCode = "AI_RATE_LIMIT";
      errorMessage = "Se alcanzó el límite de consultas de la IA. Intenta de nuevo en unos minutos.";
    } else if (error instanceof Anthropic.APIError && /credit|billing|balance/i.test(error.message)) {
      errorCode = "AI_BILLING";
      errorMessage = "La cuenta de Anthropic no tiene saldo. Carga crédito en console.anthropic.com → Billing.";
    } else if (error instanceof Anthropic.APIError && (error.status ?? 0) >= 500) {
      errorCode = "AI_HIGH_DEMAND";
      errorMessage = "El servicio de IA está con alta demanda. Intenta de nuevo en unos segundos.";
    }
    res.status(500).json({ error: errorCode, message: errorMessage });
  }
}
