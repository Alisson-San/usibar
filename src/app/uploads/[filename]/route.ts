import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!/^usibar-[a-f0-9-]{36}\.webp$/.test(filename))
    return new NextResponse(null, { status: 404 });
  try {
    const file = await fs.readFile(
      path.join(process.cwd(), "data/uploads", filename),
    );
    return new NextResponse(file, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
