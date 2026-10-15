import { isDemo } from "@/lib/runtime.mjs";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { authorized, sameOrigin } from "@/lib/auth";
import { removeBackground } from "@/lib/cutout.mjs";
export const runtime = "nodejs";
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
    const name = "usibar-" + randomUUID() + ".webp";
    const dir = path.join(process.cwd(), "data/uploads");
    await fs.mkdir(dir, { recursive: true });
    await pipeline.webp({ quality: 90 }).toFile(path.join(dir, name));
    return NextResponse.json({ url: "/uploads/" + name });
  } catch {
    return NextResponse.json(
      { error: "Imagem inválida ou grande demais para processar." },
      { status: 400 },
    );
  }
}
