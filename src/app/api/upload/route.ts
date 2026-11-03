import { NextResponse } from "next/server";
import sharp from "sharp";
import { authorized, sameOrigin } from "@/lib/auth";
import { removeBackground } from "@/lib/cutout.mjs";
import { readOnlyError, store } from "@/lib/content";
export const runtime = "nodejs";
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
      .resize(1100, 850, { fit: "inside", withoutEnlargement: true });
    if (form.get("removeBg") === "true") {
      const { data, info } = await pipeline
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      pipeline = sharp(removeBackground(data, info.width, info.height), {
        raw: { width: info.width, height: info.height, channels: 4 },
      });
    }
    const webp = await pipeline.webp({ quality: 90 }).toBuffer();
    try {
      return NextResponse.json({ url: await s.saveImage(webp) });
    } catch {
      return NextResponse.json(
        { error: "Não foi possível guardar a imagem." },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Imagem inválida ou grande demais para processar." },
      { status: 400 },
    );
  }
}
