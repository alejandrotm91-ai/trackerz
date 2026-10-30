# Trackerz

App React + Vite (carpeta `src/`) servida desde Cloudflare Workers. Todo corre en Cloudflare + Claude: no hay Firebase ni Google.

- `src/worker/` — API (Hono):
  - `auth.ts` — inicio de sesión propio (usuario + contraseña) con cookie firmada. Roles: `admin` (usuario "admin", puede publicar) y `viewer` (cualquier otro usuario, solo consulta).
  - `cloud.ts` — almacén en D1 del cronograma ("master") y la matriz de personal ("personal"), partidos en trozos JSON; y documentos sueltos (reportes de IA).
  - `ai.ts` + `llm.ts` — IA con Claude.
  - `index.ts` — rutas, incluida la sincronización "Master CDO".
- `src/utils/cloudSync.ts` — lado navegador del almacén (subir, confirmar y leer planes). `src/utils/api.ts` — `apiFetch` con manejo de errores.
- `src/db/` — esquema Drizzle (SQLite/D1) y consultas. Migraciones en `migrations/`.
- `wrangler.jsonc` — configuración de Cloudflare (este proyecto usa Wrangler, no `cf` directo).
- `scripts-legacy/` — scripts sueltos que dejó Google AI Studio. No se usan.
- `src/gestiona/` — pestaña Gestiona (actividades y reuniones de obra), traída del repo `alejandrotm91-ai/gestiona` sin Firebase ni IA. Datos en D1 (`gestiona_docs`, un JSON por registro y colección) vía `src/worker/gestiona.ts` (`/api/gestiona`). Todos consultan; solo el admin modifica (`canUserEdit` → `getPuedeEscribir`). La pestaña relee los datos cada 15 s. El admin puede importar un respaldo JSON `{coleccion: [registros]}`; importar reemplaza los registros con el mismo id.

## Comandos
- `npm run dev` — compila y corre todo local (Worker + D1 simulada) en http://localhost:8787. Requiere `.dev.vars` (copiar de `.dev.vars.example`) y `npm run db:migrate:local` la primera vez.
- `npm run dev:ui` — solo la interfaz con recarga rápida (sin API)
- `npm run lint` — revisa tipos (interfaz y Worker)
- `npm run db:generate` — genera migración tras cambiar `src/db/schema.ts`
- `npm run db:migrate:local` / `npm run db:migrate` — aplica migraciones en D1 local / remota
- `npm run deploy` — compila y publica en Cloudflare

## Secretos (Cloudflare)
Se guardan con `npx wrangler secret put NOMBRE`. Nunca poner claves ni contraseñas en el repositorio.
- `ANTHROPIC_API_KEY` — clave de la API de Claude
- `ADMIN_PASSWORD` — contraseña del usuario "admin"
- `APP_PASSWORD` — contraseña para el resto de usuarios
- `SESSION_SECRET` — texto largo y aleatorio para firmar la sesión

## IA
Claude vía `@anthropic-ai/sdk`. Todo está en `src/worker/llm.ts`: `claude-opus-5-5` por defecto y `claude-sonnet-5-5` para el reporte del botón Inteligencia (`/api/ai/crono-report`). Las rutas `/api/ai/*` exigen sesión (el reporte de cronograma, rol admin), porque cada consulta cuesta.

## Notas
- D1 limita 100 parámetros por consulta y 2 MB por fila: por eso cada partida del Master CDO se guarda como JSON en `master_items.data`, y el cronograma y el personal se suben en trozos de ~700.000 caracteres.
- Al confirmar un plan nuevo (`POST /api/cloud/:kind/:planId/commit`) se borran los anteriores del mismo tipo.
