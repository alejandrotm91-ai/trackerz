# Trackerz

App React + Vite (carpeta `src/`) servida desde Cloudflare Workers.

- `src/worker/` — API (Hono): Gemini, y sincronización "Master CDO" contra D1. Verifica tokens de Firebase con `jose`.
- `src/db/` — esquema Drizzle (SQLite/D1) y consultas. Migraciones en `migrations/`.
- `wrangler.jsonc` — configuración de Cloudflare (este proyecto usa Wrangler, no `cf` directo).
- `scripts-legacy/` — scripts sueltos que dejó Google AI Studio. No se usan.

## Comandos
- `npm run dev` — compila y corre todo local (Worker + D1 simulada) en http://localhost:8787
- `npm run dev:ui` — solo la interfaz con recarga rápida (sin API)
- `npm run lint` — revisa tipos (interfaz y Worker)
- `npm run db:generate` — genera migración tras cambiar `src/db/schema.ts`
- `npm run db:migrate` — aplica migraciones en D1 remota
- `npm run deploy` — compila y publica en Cloudflare

## Secretos
`GEMINI_API_KEY` va como secreto: `npx wrangler secret put GEMINI_API_KEY`. Local: archivo `.dev.vars` (ignorado por git). Nunca en el repositorio.

## Notas
- Firebase (Auth y Firestore) sigue en Google. El dominio donde se publique debe estar en Firebase > Authentication > Settings > Authorized domains.
- D1 limita 100 parámetros por consulta: por eso cada partida se guarda como JSON en `master_items.data`.
