import { NextResponse } from "next/server";
import { authorized, sameOrigin } from "@/lib/auth";
import { imageBase, readOnlyError, store } from "@/lib/content";
import { validData } from "@/lib/security.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  try {
    return NextResponse.json(await store().read(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível carregar os dados." },
      { status: 500 },
    );
  }
}
export async function POST(req: Request) {
  const s = store();
  if (s.readonly)
    return NextResponse.json({ error: readOnlyError }, { status: 403 });
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  if (!(await authorized()))
    return NextResponse.json(
      { error: "Sessão expirada. Entre novamente." },
      { status: 401 },
    );
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 1000000)
      return NextResponse.json({ error: "Dados muito grandes" }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Solicitação inválida" }, { status: 400 });
  }
  if (!validData(body, { remoteBase: imageBase() }))
    return NextResponse.json(
      { error: "Revise os campos, categorias, códigos e imagens." },
      { status: 400 },
    );
  try {
    await s.write(body);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível salvar os dados." },
      { status: 502 },
    );
  }
}
