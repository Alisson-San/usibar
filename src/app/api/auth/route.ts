import { isDemo } from "@/lib/runtime.mjs";
import { store } from "@/lib/content";
import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/auth";
import { createSession, equal, validSession } from "@/lib/security.mjs";
import { useLocalFiles } from "@/lib/storage.mjs";
import { cookies } from "next/headers";
export const runtime = "nodejs";

// Production uses Supabase Auth in the browser; this route only describes the mode.
// The password cookie below exists solely for local development (USIBAR_STORAGE=file).
let attempts = 0,
  reset = 0;
export async function GET() {
  const local = !isDemo() && useLocalFiles();
  return NextResponse.json(
    {
      authenticated: local
        ? validSession(
            (await cookies()).get("usibar-session")?.value,
            process.env.ADMIN_PASSWORD || "",
          )
        : false,
      demoMode: isDemo(),
      storage: store().kind,
      login: local ? "password" : "supabase",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  if (isDemo())
    return NextResponse.json(
      {
        error:
          "A demonstração permite apenas consulta. A edição fica disponível na instalação local ou com o Supabase configurado.",
      },
      { status: 403 },
    );
  if (!useLocalFiles())
    return NextResponse.json(
      { error: "O acesso é feito com a conta do Supabase." },
      { status: 404 },
    );
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (Date.now() > reset) {
    attempts = 0;
    reset = Date.now() + 60000;
  }
  if (attempts >= 10)
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um minuto." },
      { status: 429 },
    );
  attempts++;
  try {
    const { password } = await req.json();
    const secret = process.env.ADMIN_PASSWORD;
    if (!secret)
      return NextResponse.json(
        { error: "Configure ADMIN_PASSWORD no servidor." },
        { status: 503 },
      );
    if (typeof password !== "string" || !equal(password, secret))
      return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
    attempts = 0;
    const res = NextResponse.json({ ok: true });
    res.cookies.set("usibar-session", createSession(secret), {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(req.url).protocol === "https:",
      path: "/",
      maxAge: 28800,
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Solicitação inválida" },
      { status: 400 },
    );
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("usibar-session");
  return res;
}
