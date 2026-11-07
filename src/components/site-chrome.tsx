"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Person } from "@/lib/types";
import type { Role } from "@/lib/permissions";
import { demoPerson } from "@/lib/demo-data";
import { isDemoPath } from "@/lib/demo-mode";
import { DemoModeProvider, useDemoMode } from "./demo-mode";
import { DemoBanner } from "./demo-banner";
import { Header } from "./header";
import { Footer } from "./footer";

type User = (Person & { role?: Role }) | null;
export function SiteChrome({ user, initialDemo, presentationEnabled, children }: { user: User; initialDemo: boolean; presentationEnabled: boolean; children: ReactNode }) {
  return <DemoModeProvider initialActive={initialDemo} authenticated={!!user}><Chrome user={user} presentationEnabled={presentationEnabled}>{children}</Chrome></DemoModeProvider>;
}
function Chrome({ user, presentationEnabled, children }: { user: User; presentationEnabled: boolean; children: ReactNode }) {
  const mode = useDemoMode();
  const pathname = usePathname();
  const blocked = !!user && isDemoPath(pathname);
  const displayedUser = user || (mode.active ? demoPerson : null);
  return <>
    <Header user={displayedUser} demo={mode.active} onDemoExit={mode.exit}/>
    {mode.active && <DemoBanner/>}
    {blocked ? <AuthenticatedDemoRedirect/> : children}
    <Footer user={displayedUser} demo={mode.active} presentationEnabled={presentationEnabled}/>
  </>;
}
function AuthenticatedDemoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/meus-projetos"); }, [router]);
  return <main id="conteudo" className="container inner-page" aria-busy="true"><p role="status">Abrindo seus projetos…</p><Link href="/meus-projetos">Meus projetos</Link></main>;
}
