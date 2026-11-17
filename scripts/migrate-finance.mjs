// Optional one-time setup. Never run automatically during build or startup.
import { readFileSync, existsSync } from "node:fs";
import { Client } from "pg";
import { FINANCE_SCHEMA } from "./finance-schema.mjs";
for (const path of [".env.local", ".env"]) {
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) { console.error("Finance setup needs the existing database connection. Nothing was changed."); process.exit(1); }
const client = new Client({ connectionString });
try { await client.connect(); await client.query("begin"); await client.query(FINANCE_SCHEMA); await client.query("commit"); console.log("Finance tables are ready. Existing Backstage records were not modified."); }
catch (error) { await client.query("rollback").catch(() => {}); console.error("Finance setup did not complete."); process.exitCode = 1; }
finally { await client.end(); }
