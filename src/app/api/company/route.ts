import demoCatalog from "../../../../data/db.json";
import { isDemo } from "@/lib/runtime.mjs";
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { authorized, sameOrigin } from "@/lib/auth";
import { validData } from "@/lib/security.mjs";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const DB_PATH = path.join(process.cwd(), "data", "db.json");
export async function GET() {
  if (isDemo())
    return NextResponse.json({
      company: demoCatalog.company,
      products: demoCatalog.products,
      pillars: demoCatalog.pillars,
      sectors: demoCatalog.sectors,
    });
  try {
    const { adminPassword, ...data } = JSON.parse(
      await fs.readFile(DB_PATH, "utf8"),
    );
    return NextResponse.json(data, {
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
  try {
    const raw = await req.text();
    if (raw.length > 1000000)
      return NextResponse.json(
        { error: "Dados muito grandes" },
        { status: 413 },
      );
    const body = JSON.parse(raw);
    if (!validData(body))
      return NextResponse.json(
        { error: "Revise os campos, categorias, códigos e imagens." },
        { status: 400 },
      );
    const db = JSON.parse(await fs.readFile(DB_PATH, "utf8"));
    delete db.adminPassword;
    db.company = body.company;
    db.products = body.products;
    const temp = DB_PATH + "." + randomUUID() + ".tmp";
    await fs.writeFile(temp, JSON.stringify(db, null, 2));
    await fs.rename(temp, DB_PATH);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível salvar os dados." },
      { status: 400 },
    );
  }
}
