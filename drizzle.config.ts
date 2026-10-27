import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { assertRuntimeTarget } from "./src/lib/database-target.cjs";

config({ path: ".env.local" });
assertRuntimeTarget(process.env.DATABASE_URL!);

export default defineConfig({
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
