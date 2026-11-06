import { NextResponse } from "next/server";
import { authorize, sameOrigin } from "@/lib/auth";
import { bundled, imageBase, readOnlyError, store } from "@/lib/content";
import { networkProblem } from "@/lib/net.mjs";
import { validData } from "@/lib/security.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Visitors always get a page: if the content store cannot be read, the catalog shipped with
// the code is served and marked "stale", so the editor refuses to save over the real data.
export async function GET() {
  try {
    return NextResponse.json(await store().read(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const problem = networkProblem(e, "o Supabase");
    console.error("[api/company] leitura do conteúdo falhou:", problem ? problem.message : e);
    return NextResponse.json(
      { ...bundled, stale: true, staleReason: problem?.kind ?? "error" },
      { headers: { "Cache-Control": "no-store", "X-Content-Source": "bundled-fallback" } },
    );
  }
}
export async function POST(req: Request) {
  const s = store();
  if (s.readonly)
    return NextResponse.json({ error: readOnlyError }, { status: 403 });
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const access = await authorize(req);
  if (!access.ok)
    return NextResponse.json({ error: access.error }, { status: access.status });
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
    await s.write(body, access.ok ? access.token : undefined);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if ([401, 403].includes((e as { status?: number }).status ?? 0))
      return NextResponse.json({ error: "Sem permissão para salvar. Entre novamente." }, { status: 401 });
    const problem = networkProblem(e, "o Supabase");
    console.error("[api/company] gravação do conteúdo falhou:", problem ? problem.message : e);
    return NextResponse.json(
      { error: problem?.message ?? "Não foi possível salvar os dados." },
      { status: problem ? 503 : 502 },
    );
  }
}
