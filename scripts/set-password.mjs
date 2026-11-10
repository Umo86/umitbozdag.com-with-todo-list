// Set or change a Backstage password (stored hashed; signs that person out
// on every device). Usage:
//   DATABASE_URL=... node scripts/set-password.mjs <umit|dilfiraz> '<new password>'
import pg from "pg";
import { randomBytes, scryptSync } from "node:crypto";

const [user, pw] = process.argv.slice(2);
if (!["umit", "dilfiraz"].includes(user) || !pw) {
  console.error("Usage: node scripts/set-password.mjs <umit|dilfiraz> '<new password>'");
  process.exit(1);
}
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("base64")}$${scryptSync(pw, salt, 32).toString("base64")}`;
const client = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL });
await client.connect();
const r = await client.query(`update users set password_hash = $2 where id = $1`, [user, hash]);
await client.end();
console.log(r.rowCount ? `Password set for ${user}.` : `No user ${user}: run npm run migrate first.`);
