"use client";

import { Suspense, use, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { AuthenticationState, PublicIdentity } from "@/lib/public-identity";
import { demoPerson } from "@/lib/demo-data";
import { isDemoPath } from "@/lib/demo-mode";
import { DemoModeProvider, useDemoMode } from "./demo-mode";
import { DemoBanner } from "./demo-banner";
import { Header } from "./header";
import { Footer } from "./footer";
import { PublishIdentityContext } from "./publish-project-link";
import { ErrorRecovery } from "./error-recovery";

export function SiteChrome({ identity, authenticated, initialDemo, presentationEnabled, children }: { identity: Promise<PublicIdentity>; authenticated: Promise<AuthenticationState>; initialDemo: boolean; presentationEnabled: boolean; children: ReactNode }) {
  // Only entering/staying in demo needs an identity gate around its content.
  // Public pages stream independently of the account menu and footer.
  return <Suspense fallback={null}><DemoModeProvider initialActive={initialDemo} authenticated={authenticated}>
    <PublishIdentityContext value={authenticated}><Chrome identity={identity} presentationEnabled={presentationEnabled}>{children}</Chrome></PublishIdentityContext>
  </DemoModeProvider></Suspense>;
}
function Chrome({ identity, presentationEnabled, children }: { identity: Promise<PublicIdentity>; presentationEnabled: boolean; children: ReactNode }) {
  const mode = useDemoMode();
  return <>
    <Suspense fallback={<Header user={null} pending/>}><AccountHeader identity={identity}/></Suspense>
    {mode.active && <DemoBanner/>}
    <ChromeContent identity={identity}>{children}</ChromeContent>
    <Suspense fallback={null}><AccountFooter identity={identity} presentationEnabled={presentationEnabled}/></Suspense>
  </>;
}
function AccountHeader({ identity }: { identity: Promise<PublicIdentity> }) {
  const current = use(identity);
  const mode = useDemoMode();
  return <Header user={current.user || (mode.active ? demoPerson : null)} unavailable={current.status === "unavailable"} demo={mode.active} onDemoExit={mode.exit}/>;
}
function AccountFooter({ identity, presentationEnabled }: { identity: Promise<PublicIdentity>; presentationEnabled: boolean }) {
  const current = use(identity);
  const mode = useDemoMode();
  return <Footer user={current.user || (mode.active ? demoPerson : null)} unavailable={current.status === "unavailable"} demo={mode.active} presentationEnabled={presentationEnabled}/>;
}
function ChromeContent({ identity, children }: { identity: Promise<PublicIdentity>; children: ReactNode }) {
  const pathname = usePathname();
  if (!isDemoPath(pathname)) return children;
  const current = use(identity);
  if (current.status === "unavailable") return <UnavailableDemo/>;
  return current.user ? <AuthenticatedDemoRedirect/> : children;
}
function UnavailableDemo() {
  const router = useRouter();
  return <ErrorRecovery error={null} retry={() => router.refresh()}/>;
}
function AuthenticatedDemoRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/meus-projetos"); }, [router]);
  return <main id="conteudo" className="container inner-page" aria-busy="true"><p role="status">Abrindo seus projetos…</p><Link href="/meus-projetos">Meus projetos</Link></main>;
}
