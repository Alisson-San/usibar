import { NextResponse } from "next/server";
import { authorize, sameOrigin } from "@/lib/auth";
import { bundled, store } from "@/lib/content";
import { isDemo } from "@/lib/runtime.mjs";
import { aiConfigured, aiError, MODEL, reviewPage, rewriteField } from "@/lib/ai";
import { companyFacts, rateLimiter, validateAiRequest } from "@/lib/ai-rules.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const allow = rateLimiter(20, 60_000);

// Lets the editor show whether the assistant is available, without revealing anything else.
export async function GET() {
  return NextResponse.json({ configured: !isDemo() && aiConfigured(), model: MODEL }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  if (isDemo()) return NextResponse.json({ error: "A demonstração não usa a IA." }, { status: 403 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const access = await authorize(req);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!aiConfigured())
    return NextResponse.json(
      { error: "A IA ainda não está configurada. Defina GEMINI_API_KEY nas variáveis de ambiente do servidor." },
      { status: 503 },
    );
  if (!allow()) return NextResponse.json({ error: "Muitos pedidos à IA em pouco tempo. Aguarde um minuto." }, { status: 429 });
  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 200_000) return NextResponse.json({ error: "Solicitação grande demais." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }
  const parsed = validateAiRequest(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  // Facts come from the saved content, not from the request, so the model is grounded in what is published.
  const facts = companyFacts(await store().read().catch(() => bundled));
  try {
    const { value } = parsed;
    const result = value.action === "review" ? await reviewPage(value.fields, facts) : await rewriteField(value, facts);
    return NextResponse.json(result);
  } catch (e) {
    const { status, error } = aiError(e);
    console.error("[api/ai] falha:", ...((e as { status?: number }).status ? [error, (e as { detail?: string }).detail ?? ""] : [e]));
    return NextResponse.json({ error }, { status });
  }
}
