import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DemoWorkspaceProvider } from "@/components/demo-workspace";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Demonstração", robots: { index: false, follow: false } };
export default async function DemoLayout({ children }: { children: ReactNode }) {
  if (await getCurrentUser()) redirect("/meus-projetos");
  return <DemoWorkspaceProvider>{children}</DemoWorkspaceProvider>;
}
