"use client";

import { Suspense, use, useEffect, type ReactNode } from "react";
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
export function SiteChrome({ user, authenticated, initialDemo, presentationEnabled, children }: { user: Promise<User>; authenticated: Promise<boolean>; initialDemo: boolean; presentationEnabled: boolean; children: ReactNode }) {
  // Only entering/staying in demo needs an identity gate around its content.
  // Public pages stream independently of the account menu and footer.
  return <Suspense fallback={null}><DemoModeProvider initialActive={initialDemo} authenticated={authenticated}>
    <Chrome user={user} presentationEnabled={presentationEnabled}>{children}</Chrome>
  </DemoModeProvider></Suspense>;
}
function Chrome({ user, presentationEnabled, children }: { user: Promise<User>; presentationEnabled: boolean; children: ReactNode }) {
  const mode = useDemoMode();
  return <>
    <Suspense fallback={<Header user={null} pending/>}><AccountHeader user={user}/></Suspense>
    {mode.active && <DemoBanner/>}
    <ChromeContent user={user}>{children}</ChromeContent>
    <Suspense fallback={null}><AccountFooter user={user} presentationEnabled={presentationEnabled}/></Suspense>
  </>;
}
function AccountHeader({ user }: { user: Promise<User> }) {
  const current = use(user);
  const mode = useDemoMode();
  return <Header user={current || (mode.active ? demoPerson : null)} demo={mode.active} onDemoExit={mode.exit}/>;
}
function AccountFooter({ user, presentationEnabled }: { user: Promise<User>; presentationEnabled: boolean }) {
  const current = use(user);
  const mode = useDemoMode();
  return <Footer user={current || (mode.active ? demoPerson : null)} demo={mode.active} presentationEnabled={presentationEnabled}/>;
}
function ChromeContent({ user, children }: { user: Promise<User>; children: ReactNode }) {
  const pathname = usePathname();
  if (!isDemoPath(pathname)) return children;
  const current = use(user);
  return current ? <AuthenticatedDemoRedirect/> : children;
}
function AuthenticatedDemoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/meus-projetos"); }, [router]);
  return <main id="conteudo" className="container inner-page" aria-busy="true"><p role="status">Abrindo seus projetos…</p><Link href="/meus-projetos">Meus projetos</Link></main>;
}
