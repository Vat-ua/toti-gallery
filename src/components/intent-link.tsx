"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

/** Card links preload on intent instead of fetching every visible destination. */
export function IntentLink({ onMouseEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [active, setActive] = useState(false);
  return <Link {...props} prefetch={active} onMouseEnter={event => { onMouseEnter?.(event); setActive(true); }} onFocus={event => { onFocus?.(event); setActive(true); }}/>;
}
