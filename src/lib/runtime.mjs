// Read-only only when explicitly rehearsing the demo. Production edits go to Supabase,
// where the database checks the signed-in admin.
export const isDemo = (env = process.env) => env.DEMO_MODE === "true";
