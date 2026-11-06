import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_MODE_COOKIE } from "@/lib/demo-mode";
import { SiteChrome } from "@/components/site-chrome";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Toti Gallery — projetos da comunidade Toti", template: "%s · Toti Gallery" },
  description: "Exercícios, experimentos e aplicações completas publicados por estudantes e pessoas formadas nas turmas da Toti.",
  icons: { icon: "/favicon.svg" },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f0e6" }, { media: "(prefers-color-scheme: dark)", color: "#12110f" }] };

const themeScript = `(function(){try{var d=document.documentElement;var stored=null;try{stored=localStorage.getItem('toti-theme');}catch(e){}var prefers=window.matchMedia('(prefers-color-scheme: dark)').matches;var theme=(stored==='light'||stored==='dark')?stored:(prefers?'dark':'light');d.dataset.theme=theme;d.style.colorScheme=theme;}catch(e){}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  const initialDemo = !user && (await cookies()).get(DEMO_MODE_COOKIE)?.value === "1";
  return <html lang="pt-BR" data-theme="light" data-scroll-behavior="smooth" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }}/></head><body><ToastProvider><a href="#conteudo" className="skip-link">Pular para o conteúdo</a><SiteChrome user={user} initialDemo={initialDemo}>{children}</SiteChrome></ToastProvider></body></html>;
}
