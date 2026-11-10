"use client";

import { createContext, use, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DEMO_MODE_EVENT, isDemoPath, readDemoMode, writeDemoMode } from "@/lib/demo-mode";
import type { AuthenticationState } from "@/lib/public-identity";

type Mode = { active: boolean; revision: number; exit: () => void; restored: () => void };
const DemoModeContext = createContext<Mode>({ active: false, revision: 0, exit: () => {}, restored: () => {} });
export const useDemoMode = () => useContext(DemoModeContext);
function subscribe(listener: () => void) {
  window.addEventListener(DEMO_MODE_EVENT, listener);
  window.addEventListener("focus", listener);
  window.addEventListener("pageshow", listener);
  document.addEventListener("visibilitychange", listener);
  return () => {
    window.removeEventListener(DEMO_MODE_EVENT, listener);
    window.removeEventListener("focus", listener);
    window.removeEventListener("pageshow", listener);
    document.removeEventListener("visibilitychange", listener);
  };
}
export function DemoModeProvider({ initialActive, authenticated: identity, children }: { initialActive: boolean; authenticated: AuthenticationState | Promise<AuthenticationState>; children: ReactNode }) {
  const pathname = usePathname();
  const demoRoute = isDemoPath(pathname);
  const stored = useSyncExternalStore(subscribe, readDemoMode, () => initialActive);
  // Identity is essential for demo isolation, but ordinary public pages do not
  // need to wait for it just to render their content.
  const authenticated = identity === null || typeof identity === "boolean" ? identity : stored || demoRoute ? use(identity) : false;
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (authenticated) { if (readDemoMode()) writeDemoMode(false); }
    else if (authenticated === false && demoRoute && !readDemoMode()) writeDemoMode(true);
  }, [authenticated, demoRoute, pathname]);
  return <DemoModeContext.Provider value={{
    active: authenticated === false && (stored || demoRoute), revision,
    exit: () => writeDemoMode(false), restored: () => setRevision(value => value + 1),
  }}>{children}</DemoModeContext.Provider>;
}
