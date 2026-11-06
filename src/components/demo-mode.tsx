"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DEMO_MODE_EVENT, isDemoPath, readDemoMode, writeDemoMode } from "@/lib/demo-mode";

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
export function DemoModeProvider({ initialActive, authenticated, children }: { initialActive: boolean; authenticated: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const demoRoute = isDemoPath(pathname);
  const stored = useSyncExternalStore(subscribe, readDemoMode, () => initialActive);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (authenticated) { if (readDemoMode()) writeDemoMode(false); }
    else if (demoRoute && !readDemoMode()) writeDemoMode(true);
  }, [authenticated, demoRoute, pathname]);
  return <DemoModeContext.Provider value={{
    active: !authenticated && (stored || demoRoute), revision,
    exit: () => writeDemoMode(false), restored: () => setRevision(value => value + 1),
  }}>{children}</DemoModeContext.Provider>;
}
