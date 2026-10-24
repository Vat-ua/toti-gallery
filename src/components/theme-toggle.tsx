"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Icon } from "./icon";

type Theme = "light" | "dark";
const STORAGE_KEY = "toti-theme";
const CHANGE_EVENT = "toti-theme-change";

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function preferredTheme(): Theme {
  return storedTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  function followSystem() {
    if (!storedTheme()) applyTheme(media.matches ? "dark" : "light");
  }
  function syncStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY || event.key === null) applyTheme(preferredTheme());
  }
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", syncStorage);
  media.addEventListener("change", followSystem);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", syncStorage);
    media.removeEventListener("change", followSystem);
  };
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");

  // Restore the preference before paint if Strict Mode resets the HTML attributes.
  useLayoutEffect(() => { applyTheme(preferredTheme()); }, []);

  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the current visit usable without storage. */ }
    applyTheme(next);
  }

  const label = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  return <button type="button" className="theme-toggle" onClick={toggle} aria-label={label} title={label}>
    <span className="theme-toggle-icons" aria-hidden="true"><Icon name="sun" size={17} className="theme-icon-sun"/><Icon name="moon" size={17} className="theme-icon-moon"/></span>
  </button>;
}
