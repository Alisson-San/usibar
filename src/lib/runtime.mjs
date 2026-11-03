export const supabaseConfigured = (env = process.env) =>
  Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
// Read-only when explicitly rehearsing the demo, or on Vercel without durable storage:
// function disks there are ephemeral, so edits would silently vanish.
export const isDemo = (env = process.env) =>
  env.DEMO_MODE === "true" || (env.VERCEL === "1" && !supabaseConfigured(env));
