import { NextResponse } from "next/server";
import sharp from "sharp";
import { authorize, sameOrigin } from "@/lib/auth";
import { removeBackground } from "@/lib/cutout.mjs";
import { readOnlyError, store } from "@/lib/content";
import { networkProblem } from "@/lib/net.mjs";
export const runtime = "nodejs";
// Saves Supabase storage and egress: longest side 1600 px, WebP, at most 1 MB (bucket limit).
const MAX_SIDE = 1600;
const MAX_RESULT = 1024 * 1024;
export async function POST(req: Request) {
  const s = store();
  if (s.readonly)
    return NextResponse.json({ error: readOnlyError }, { status: 403 });
  if (!sameOrigin(req))
    return NextResponse.json({ error: "Origem inválida" }, { status: 403 });
  const access = await authorize(req);
  if (!access.ok)
    return NextResponse.json({ error: access.error }, { status: access.status });
  if (Number(req.headers.get("content-length")) > 9 * 1024 * 1024)
    return NextResponse.json(
      { error: "Limite de 8 MB por imagem." },
      { status: 413 },
    );
  try {
    const form = await req.formData(),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      return NextResponse.json(
        { error: "Envie uma imagem JPG, PNG ou WebP." },
        { status: 400 },
      );
    if (file.size > 8 * 1024 * 1024)
      return NextResponse.json(
        { error: "Limite de 8 MB por imagem." },
        { status: 413 },
      );
    const buffer = Buffer.from(await file.arrayBuffer());
    let pipeline = sharp(buffer, { limitInputPixels: 25000000 })
      .rotate()
      .resize(MAX_SIDE, MAX_SIDE, { fit: "inside", withoutEnlargement: true });
    if (form.get("removeBg") === "true") {
      const { data, info } = await pipeline
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      pipeline = sharp(removeBackground(data, info.width, info.height), {
        raw: { width: info.width, height: info.height, channels: 4 },
      });
    }
    const webp = await pipeline.webp({ quality: 90, alphaQuality: 100 }).toBuffer();
    if (webp.length > MAX_RESULT)
      return NextResponse.json(
        { error: "A imagem continua acima de 1 MB depois da compressão. Use uma foto menor ou mais simples." },
        { status: 413 },
      );
    try {
      return NextResponse.json({ url: await s.saveImage(webp, access.ok ? access.token : undefined) });
    } catch (e) {
      if ([401, 403].includes((e as { status?: number }).status ?? 0))
        return NextResponse.json({ error: "Sem permissão para enviar. Entre novamente." }, { status: 401 });
      const problem = networkProblem(e, "o Supabase");
      console.error("[api/upload] envio da imagem falhou:", problem ? problem.message : e);
      return NextResponse.json(
        { error: problem?.message ?? "Não foi possível guardar a imagem." },
        { status: problem ? 503 : 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Imagem inválida ou grande demais para processar." },
      { status: 400 },
    );
  }
}
