import { cookies } from "next/headers";
import { validSession } from "./security.mjs";
import { isSiteAdmin, supabaseSettings, useLocalFiles } from "./storage.mjs";

export type Access = { ok: true; token?: string } | { ok: false };

/**
 * Who may edit. With Supabase (production) the browser sends the admin's access token as a
 * Bearer; we only ask the database whether that user administers this site, and later perform
 * the write as that same user. Local file mode (USIBAR_STORAGE=file, development only) keeps a
 * password cookie, since there is no database to ask.
 */
let failures = 0,
  resetAt = 0;
export async function authorize(req: Request): Promise<Access> {
  if (useLocalFiles()) {
    const ok = validSession(
      (await cookies()).get("usibar-session")?.value,
      process.env.ADMIN_PASSWORD || "",
    );
    return ok ? { ok: true } : { ok: false };
  }
  const token = /^Bearer (\S+)$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (Date.now() > resetAt) {
    failures = 0;
    resetAt = Date.now() + 60000;
  }
  if (failures >= 30) return { ok: false }; // brake for floods of bad tokens
  if (token && (await isSiteAdmin(supabaseSettings(), token))) return { ok: true, token };
  failures++;
  return { ok: false };
}

export function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      url.host === req.headers.get("host")
    );
  } catch {
    return false;
  }
}
