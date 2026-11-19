import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const secrets = ["SUPABASE_SERVICE_ROLE_KEY", "ENCRYPTION_MASTER_KEY", "META_APP_SECRET", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "XAI_API_KEY", "GEMINI_API_KEY"];
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) return sourceFiles(absolute);
    return extensions.has(path.extname(entry)) ? [absolute] : [];
  });
}

/** Extrae únicamente las llamadas a console, sin mezclar otras líneas del archivo. */
function consoleCalls(source: string): string[] {
  const calls: string[] = [];
  const pattern = /console\.(?:log|error|warn|info|debug)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const open = source.indexOf("(", match.index);
    let depth = 0;
    let quote: "'" | '"' | "`" | null = null;
    let escaped = false;
    for (let index = open; index < source.length; index += 1) {
      const char = source[index]!;
      if (quote) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === quote) quote = null;
        continue;
      }
      if (char === "'" || char === '"' || char === "`") {
        quote = char;
        continue;
      }
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          calls.push(source.slice(match.index, index + 1));
          pattern.lastIndex = index + 1;
          break;
        }
      }
    }
  }
  return calls;
}

describe("TC-020 — análisis estático de credenciales", () => {
  const files = sourceFiles(path.join(process.cwd(), "src"));

  it("ningún archivo cliente referencia secretos de servidor", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      const clientDirective = /^(?:\s|\/\/[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*["']use client["'];/;
      return clientDirective.test(source) && secrets.some((secret) => source.includes(secret));
    });
    expect(offenders).toEqual([]);
  });

  it("ninguna llamada de log menciona nombres de secretos", () => {
    const offenders = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return consoleCalls(source).some((call) => secrets.some((secret) => call.includes(secret)));
    });
    expect(offenders).toEqual([]);
  });

  it("la bóveda y los clientes administrativos son explícitamente server-only", () => {
    for (const file of ["src/shared/lib/crypto/vaultCipher.ts", "src/shared/lib/supabase/admin.ts", "src/shared/lib/metaWhatsAppClient.ts"]) {
      expect(readFileSync(path.join(process.cwd(), file), "utf8")).toContain('import "server-only"');
    }
  });
});
