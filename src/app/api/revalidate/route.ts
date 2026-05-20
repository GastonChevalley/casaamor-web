/**
 * POST /api/revalidate?secret=XXX
 *
 * Endpoint invocado por Apps Script cuando la dueña edita ConfigWeb, Menu o
 * Pages en la planilla. Invalida el Full Route Cache + Data Cache de Next.js
 * para que el próximo visitante vea los cambios al instante (sin esperar TTL).
 *
 * Body opcional:
 *   { paths?: string[] }   lista de paths a invalidar. Default: ["/"] con layout.
 *
 * Auth: query string `?secret=` debe matchear env `REVALIDATE_SECRET`.
 *
 * Responde JSON `{ ok: true, revalidated: [...] }` o `{ ok: false, error }`.
 */

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

const SECRET = process.env.REVALIDATE_SECRET || "";

export async function POST(req: NextRequest) {
  // Auth
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || "";
  if (!SECRET || secret !== SECRET) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Parsear paths a invalidar
  let paths: string[] = ["/"];
  try {
    const body = await req.json().catch(() => ({}));
    if (Array.isArray(body?.paths) && body.paths.length > 0) {
      paths = body.paths.filter((p: unknown) => typeof p === "string" && p.startsWith("/"));
    }
  } catch {
    // body vacío o malformado → usar default
  }

  // Invalidar
  const revalidated: string[] = [];
  for (const p of paths) {
    try {
      // 'layout' invalida tambien todos los hijos (header/footer leen ConfigWeb desde layout)
      revalidatePath(p, "layout");
      revalidated.push(p);
    } catch (err) {
      // Continuar con el resto si uno falla
      console.error("revalidatePath fallo para", p, err);
    }
  }

  return NextResponse.json({
    ok: true,
    revalidated,
    timestamp: Date.now(),
  });
}

// GET para health check (opcional, útil para testing manual)
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") || "";
  if (!SECRET || secret !== SECRET) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true, hint: "Use POST con body {paths: [...]}" });
}
