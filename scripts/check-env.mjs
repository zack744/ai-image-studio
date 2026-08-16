import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const productionEnv = resolve(process.cwd(), ".env.production");
if (!existsSync(productionEnv)) {
  console.error(
    "Missing .env.production. Copy .env.production.example to .env.production and set VITE_WORKER_URL to your deployed Worker URL.",
  );
  process.exit(1);
}

const content = readFileSync(productionEnv, "utf-8");
const match = content.match(/^VITE_WORKER_URL\s*=\s*(.+)$/m);
if (!match || !match[1].trim()) {
  console.error(
    "VITE_WORKER_URL is not set in .env.production. Set it to your deployed Worker URL before building the frontend.",
  );
  process.exit(1);
}

console.log(`VITE_WORKER_URL=${match[1].trim()}`);