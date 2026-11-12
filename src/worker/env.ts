export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  // Secretos (npx wrangler secret put NOMBRE)
  ANTHROPIC_API_KEY: string;
  ADMIN_PASSWORD: string;
  APP_PASSWORD: string;
  SESSION_SECRET: string;
}
