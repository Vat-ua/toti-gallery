"use client";

import Link from "next/link";
import { createContext, Suspense, use, useContext, type ComponentProps } from "react";
import { studentProjectLinks } from "@/lib/project-links";
import { useDemoMode } from "./demo-mode";
import type { AuthenticationState } from "@/lib/public-identity";

// Reuse the identity already started by the root layout. Only the link, never
// its surrounding page, waits for it. Known header/footer identity needs no wait.
export const PublishIdentityContext = createContext<AuthenticationState | Promise<AuthenticationState>>(false);
type LinkProps = Omit<ComponentProps<typeof Link>, "href">;
type Props = LinkProps & { authenticated?: AuthenticationState; demo?: boolean };

export function PublishProjectLink({ authenticated, demo, ...props }: Props) {
  const identity = useContext(PublishIdentityContext);
  const mode = useDemoMode();
  const demoActive = demo ?? mode.active;
  return <Suspense fallback={<Link {...props} href={demoActive ? "/demo/novo" : studentProjectLinks.create} prefetch={false}/>}>
    <ResolvedLink {...props} identity={authenticated === undefined ? identity : authenticated} demo={demoActive}/>
  </Suspense>;
}

function ResolvedLink({ identity, demo, ...props }: LinkProps & { identity: AuthenticationState | Promise<AuthenticationState>; demo: boolean }) {
  const authenticated = identity === null || typeof identity === "boolean" ? identity : use(identity);
  // Unknown identity keeps the ordinary protected destination; it never enables demo.
  const href = demo ? "/demo/novo" : authenticated === false ? `/entrar?next=${encodeURIComponent(studentProjectLinks.create)}` : studentProjectLinks.create;
  return <Link {...props} href={href}/>;
}
