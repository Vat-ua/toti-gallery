import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listAdministrators } from "@/lib/admin-administrators";
import { AdministratorsList } from "@/components/admin-administrators";

export default async function AdministratorsPage() {
  const actor = await getCurrentUser();
  if (!actor) redirect("/entrar?next=%2Fadmin%2Fadministradores");
  if (actor.role !== "owner") notFound();
  const administrators = await listAdministrators(actor.id);
  return <AdministratorsList administrators={administrators}/>;
}
