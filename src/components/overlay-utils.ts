"use client";

import { useCallback, useState } from "react";

// Native dialogs occupy the top layer: their overlays must remain inside them.
export function useOverlayContainer() {
  const [container, setContainer] = useState<HTMLDialogElement | undefined>();
  const setTrigger = useCallback((node: HTMLElement | null) => {
    setContainer(node?.closest("dialog") ?? undefined);
  }, []);
  return { setTrigger, container };
}

export const overlayPosition = {
  side: "bottom", align: "start", sideOffset: 12,
  collisionPadding: 16, avoidCollisions: true,
} as const;

export function focusOverlayTarget(event: { target: EventTarget | null; preventDefault: () => void }, selector?: string, scroll = false) {
  if (!selector || !(event.target instanceof HTMLElement)) return;
  const panel = event.target;
  const target = panel.querySelector<HTMLElement>(selector);
  if (!target) return;
  event.preventDefault();
  target.focus({ preventScroll: true });
  if (scroll) panel.scrollTop = target.offsetTop - panel.clientHeight / 2 + target.clientHeight / 2;
}
