import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entre para a comunidade" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : "";
  const nextPath = next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") && !next.startsWith("/entrar") ? next : "/meus-projetos";
  if (await getCurrentUser()) redirect(nextPath);
  return <AuthForm nextPath={nextPath} initialRegister={params.modo === "cadastro"}/>;
}
