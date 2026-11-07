import { defineConfig } from "drizzle-kit";

// Solo genera los archivos SQL de migración; D1 los aplica con `npm run db:migrate`.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
});
