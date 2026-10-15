import { cookies } from "next/headers";
import { validSession } from "./security.mjs";
export async function authorized() {
  return validSession(
    (await cookies()).get("usibar-session")?.value,
    process.env.ADMIN_PASSWORD || "",
  );
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
