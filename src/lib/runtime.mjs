export const isDemo = (env = process.env) =>
  env.VERCEL === "1" || env.DEMO_MODE === "true";
