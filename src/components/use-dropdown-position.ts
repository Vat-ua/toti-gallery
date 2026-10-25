"use client";

import { useLayoutEffect, type RefObject } from "react";

export function useDropdownPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!open || !anchor || !panel) return;

    function position() {
      if (!anchor || !panel) return;
      const trigger = anchor.getBoundingClientRect();
      const width = panel.getBoundingClientRect().width;
      const left = Math.max(16, Math.min(trigger.left, window.innerWidth - 16 - width));
      panel.style.left = `${left - trigger.left}px`;
    }

    position();
    const observer = new ResizeObserver(position);
    observer.observe(anchor);
    observer.observe(panel);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
    };
  }, [open, anchorRef, panelRef]);
}
