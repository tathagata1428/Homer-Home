/**
 * Runs before every Pages Function. Exposes the Hyperdrive connection
 * string as DATABASE_URL so lib/db.js can read it from process.env
 * (the per-route Object.assign(process.env, env) would stringify the binding).
 */
export async function onRequest(context) {
  const { env } = context;
  if (env && env.HYPERDRIVE && env.HYPERDRIVE.connectionString) {
    process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
  } else if (env && env.DATABASE_URL) {
    process.env.DATABASE_URL = env.DATABASE_URL;
  }
  if (env && env.AUTH_SECRET) process.env.AUTH_SECRET = env.AUTH_SECRET;
  return context.next();
}
