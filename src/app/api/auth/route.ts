import { isDemo } from "@/lib/runtime.mjs";
import { NextResponse } from "next/server";
import { authorized, sameOrigin } from "@/lib/auth";
import { createSession, equal } from "@/lib/security.mjs";
export const runtime = "nodejs";
let attempts = 0,
  reset = 0;
export async function GET() {
  return NextResponse.json(
    {
      authenticated: isDemo() ? false : await authorized(),
      demoMode: isDemo(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  if (isDemo())
    return NextResponse.json(
      {
        error:
          "A demonstração permite apenas consulta. A edição fica disponível na instalação local.",
      },
      { status: 403 },
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
