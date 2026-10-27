import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { authSettings, safeNextPath } from "@/lib/auth-settings";

export const metadata: Metadata = { title: "Entre para a comunidade" };
export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(nextPath);
  return <AuthForm nextPath={nextPath} googleEnabled={!!authSettings().google} initialError={params.error === "activation_account_mismatch" ? "Escolha o Google com o mesmo email do convite. Para criar uma senha, abra novamente o link de ativação." : params.error ? "Não foi possível entrar com Google. Use o email cadastrado pela administração ou entre com email e senha." : ""}/>;
}
