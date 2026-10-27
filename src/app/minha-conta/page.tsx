import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { AccountForm } from "@/components/account-form";

export const metadata: Metadata = { title: "Editar perfil" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?next=%2Fminha-conta");
  const account = (await db.select({ email: users.email }).from(users).where(eq(users.id, user.id)).limit(1))[0];
  if (!account) redirect("/entrar?next=%2Fminha-conta");
  const credentials = await db.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential"))).limit(1);
  return <AccountForm user={user} email={account.email} canChangePassword={credentials.length > 0}/>;
}
