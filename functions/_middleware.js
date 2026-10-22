/**
 * Runs before every Pages Function. Copies the string env vars into
 * process.env (lib/*.js reads config from there) and exposes the Hyperdrive
 * connection string as DATABASE_URL (a per-route Object.assign(process.env, env)
 * would stringify the binding).
 */
export async function onRequest(context) {
  const { env } = context;
  if (env && typeof env === 'object') {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string') process.env[key] = value;
    }
    if (env.HYPERDRIVE && env.HYPERDRIVE.connectionString) {
      process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
    }
  }
  return context.next();
}
