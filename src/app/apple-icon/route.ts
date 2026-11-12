import { NextResponse } from "next/server";
import sharp from "sharp";
import { micrometerFaviconSvg } from "../logo";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const png = await sharp(
    Buffer.from(micrometerFaviconSvg({ size: 360, background: "#f7f2e9", padding: 24 })),
  )
    .resize(180, 180)
    .png()
    .toBuffer();
  return new NextResponse(Buffer.from(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
