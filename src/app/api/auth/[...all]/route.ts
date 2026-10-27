import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuth } from "@/lib/auth-core";

const allowed = new Map([
  ["/sign-in/email", "POST"], ["/sign-in/social", "POST"],
  ["/callback/google", "GET"], ["/sign-out", "POST"],
  ["/get-session", "GET"], ["/error", "GET"],
]);

async function handle(request: Request) {
  const path = new URL(request.url).pathname.slice("/api/auth".length);
  // Other library endpoints are deliberately not public: no open signup,
  // arbitrary profile/email update, account deletion or provider token access.
  if (allowed.get(path) !== request.method) return Response.json({ message: "Acesso não disponível." }, { status: 403 });
  const response = await getAuth().handler(request);
  if (path === "/get-session" && response.ok) {
    const data = await response.clone().json();
    if (data?.user?.id) {
      const [user] = await db.select({ status: users.status, isDemo: users.isDemo }).from(users).where(eq(users.id, data.user.id)).limit(1);
      if (!user || user.status !== "active" || user.isDemo) return Response.json(null, { headers: { "Cache-Control": "no-store" } });
    }
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = handle;
export const POST = handle;
