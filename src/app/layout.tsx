import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header, Footer } from "@/components/header";
import { ToastProvider } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Toti Gallery — Ideias que ganham vida em código", template: "%s | Toti Gallery" },
  description: "Diferentes histórias, novas possibilidades. Descubra projetos, conheça talentos e compartilhe sua jornada de aprendizado na comunidade Toti.",
  icons: { icon: "/favicon.svg" },
};
export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  return <html lang="pt-BR"><body><ToastProvider><a href="#conteudo" className="skip-link">Pular para o conteúdo</a><Header user={user}/>{children}<Footer/></ToastProvider></body></html>;
}
