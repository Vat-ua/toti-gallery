import { db } from "@/db";
import { sql } from "drizzle-orm";

import { logServerError } from "@/lib/server-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const requestId = logServerError("health.database.failed", error, { status: 503 });
    return Response.json({ ok: false, requestId }, { status: 503, headers: { "Cache-Control": "no-store", "X-Request-Id": requestId } });
  }
}
