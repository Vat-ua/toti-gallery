import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { getCurrentUser, isSameOrigin } from "@/lib/auth";
import { getProjects } from "@/lib/queries";
import { validateCoauthorIds, validateProject } from "@/lib/validation";
import { setProjectAuthors } from "@/lib/project-authors";

export async function GET() { return Response.json(await getProjects()); }
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "Origem não permitida." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Entre na sua conta para publicar." }, { status: 401 });
  if (!user.turmaId) return Response.json({ error: "Peça à administração para associar sua conta a uma turma antes de publicar." }, { status: 403 });
  try {
    const body = await request.json();
    const data = validateProject(body);
    const coauthorIds = validateCoauthorIds(body) ?? [];
    const id = randomUUID();
    const prefix = data.title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const slug = `${prefix || "projeto"}-${id.slice(0, 8)}`;
    await db.transaction(async (tx) => {
      await tx.insert(projects).values({ ...data, id, slug, authorId: user.id, turmaId: user.turmaId! });
      await setProjectAuthors(tx, id, user.id, coauthorIds);
    });
    return Response.json({ id, slug }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível publicar o projeto." }, { status: 400 });
  }
}
