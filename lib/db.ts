import { Pool } from "pg";

// One pool per server process; cached on globalThis so Next.js dev
// hot-reloads don't leak connections.
const globalForDb = globalThis as unknown as { __bsPool?: Pool };

export function db(): Pool {
  if (!globalForDb.__bsPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Run the Neon setup and add it to the environment."
      );
    }
    globalForDb.__bsPool = new Pool({ connectionString, max: 5 });
  }
  return globalForDb.__bsPool;
}
