"use client";

import Link from "next/link";
import { createContext, Suspense, use, useContext, type ComponentProps } from "react";
import { studentProjectLinks } from "@/lib/project-links";
import { useDemoMode } from "./demo-mode";

// Reuse the identity already started by the root layout. Only the link, never
// its surrounding page, waits for it. Known header/footer identity needs no wait.
export const PublishIdentityContext = createContext<boolean | Promise<boolean>>(false);
type LinkProps = Omit<ComponentProps<typeof Link>, "href">;
type Props = LinkProps & { authenticated?: boolean; demo?: boolean };

export function PublishProjectLink({ authenticated, demo, ...props }: Props) {
  const identity = useContext(PublishIdentityContext);
  const mode = useDemoMode();
  const demoActive = demo ?? mode.active;
  return <Suspense fallback={<Link {...props} href={demoActive ? "/demo/novo" : studentProjectLinks.create} prefetch={false}/>}>
    <ResolvedLink {...props} identity={authenticated ?? identity} demo={demoActive}/>
  </Suspense>;
}

function ResolvedLink({ identity, demo, ...props }: LinkProps & { identity: boolean | Promise<boolean>; demo: boolean }) {
  const authenticated = typeof identity === "boolean" ? identity : use(identity);
  const href = demo ? "/demo/novo" : authenticated ? studentProjectLinks.create : `/entrar?next=${encodeURIComponent(studentProjectLinks.create)}`;
  return <Link {...props} href={href}/>;
}
