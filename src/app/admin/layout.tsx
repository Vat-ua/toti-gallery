import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isStaff } from "@/lib/permissions";
import { AdminNav } from "@/components/admin-nav";
export const metadata: Metadata = { title: "Administração", robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await getCurrentUser();
  if (!actor) redirect("/entrar?next=%2Fadmin%2Fturmas");
  if (!isStaff(actor.role)) notFound();
  return <main id="conteudo" className="container admin-page"><div className="admin-context"><span>Administração</span><span className="admin-role">{actor.role === "owner" ? "Proprietário" : "Administrador"}</span></div><AdminNav owner={actor.role === "owner"}/>{children}</main>;
}
