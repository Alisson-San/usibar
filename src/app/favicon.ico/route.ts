import { NextResponse } from "next/server";
import sharp from "sharp";
import { micrometerFaviconSvg } from "../logo";
import { packIco } from "@/lib/photo-edit.mjs";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const [png16, png32, png48] = await Promise.all(
    [16, 32, 48].map((size) =>
      sharp(Buffer.from(micrometerFaviconSvg({ size: size * 4, padding: 5.5 })))
        .resize(size, size)
        .png()
        .toBuffer(),
    ),
  );
  const ico = packIco([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 },
  ]);
  return new NextResponse(Buffer.from(ico), {
    headers: {
      "Content-Type": "image/x-icon",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
