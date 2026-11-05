"use client";

import { useEffect, useRef } from "react";

const message = "Você tem alterações não salvas. Deseja sair sem salvar?";

/** Guard links throughout the page, reload/close and cancellable history traversals. */
export function useUnsavedChanges(dirty: boolean) {
  const saved = useRef(false);
  useEffect(() => {
    if (!dirty) return;
    function unload(event: BeforeUnloadEvent) {
      if (saved.current) return;
      event.preventDefault(); event.returnValue = "";
    }
    function click(event: MouseEvent) {
      if (saved.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!window.confirm(message)) { event.preventDefault(); event.stopPropagation(); }
    }
    // Navigation API can cancel same-document Back/Forward without rewriting
    // history entries or Next.js router state. Older browsers lack this facility.
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    function navigate(event: Event) {
      const traversal = event as Event & { navigationType?: string; canIntercept?: boolean; destination?: { sameDocument?: boolean } };
      if (!saved.current && traversal.navigationType === "traverse" && traversal.destination?.sameDocument && traversal.canIntercept && event.cancelable && !window.confirm(message)) event.preventDefault();
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    navigation?.addEventListener("navigate", navigate);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      navigation?.removeEventListener("navigate", navigate);
    };
  }, [dirty]);
  return { markSaved: () => { saved.current = true; } };
}
