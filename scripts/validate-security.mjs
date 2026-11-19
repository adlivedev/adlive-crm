import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const secretNames = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_MASTER_KEY",
  "META_APP_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "XAI_API_KEY",
  "GEMINI_API_KEY",
];
const staticRoot = path.join(process.cwd(), ".next", "static");
const textExtensions = new Set([".js", ".mjs", ".css", ".html", ".json", ".map"]);

function filesUnder(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return filesUnder(absolute);
    return textExtensions.has(path.extname(entry)) ? [absolute] : [];
  });
}

if (!existsSync(staticRoot)) {
  console.error("No existe .next/static. Ejecuta npm run build antes de validar los bundles.");
  process.exit(1);
}

const configuredValues = secretNames
  .map((name) => ({ name, value: process.env[name] }))
  .filter((entry) => typeof entry.value === "string" && entry.value.length >= 8 && !entry.value.startsWith("REPLACE_"));
const findings = [];

for (const file of filesUnder(staticRoot)) {
  const contents = readFileSync(file, "utf8");
  const relative = path.relative(process.cwd(), file);
  for (const name of secretNames) {
    if (contents.includes(name)) findings.push(`${relative}: contiene el nombre reservado ${name}`);
  }
  for (const entry of configuredValues) {
    if (contents.includes(entry.value)) findings.push(`${relative}: contiene el valor configurado de ${entry.name}`);
  }
}

if (findings.length > 0) {
  console.error(`Validación de bundles fallida (${findings.length} hallazgos):\n${findings.join("\n")}`);
  process.exit(1);
}

console.log(`Bundles cliente verificados: ${filesUnder(staticRoot).length} archivos sin nombres ni valores configurados de secretos.`);
