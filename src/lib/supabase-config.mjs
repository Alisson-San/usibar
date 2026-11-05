// Central Supabase project shared by several sites; this one is the schema "usibar".
// Browser-safe values only: the publishable key does what row level security allows,
// and writes carry the signed-in admin's own JWT. NEVER use the service role key here.
export const SITE_ID = "usibar";
export const SUPABASE_DEFAULTS = {
  url: "https://rwkvsepkevhqzpltmsck.supabase.co",
  key: "sb_publishable_FqO5YvR5KmiDVuynAGw6Hg_sOncWykC",
  bucket: "usibar",
};
