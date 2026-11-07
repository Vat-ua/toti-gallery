"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
import { useProjectLike } from "./use-project-like";
import type { Person } from "@/lib/types";
import type { LikeAction } from "@/lib/likes-client";

const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
const ToastContainerContext = createContext<(container: HTMLElement) => () => void>(() => () => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const [containers, setContainers] = useState<HTMLElement[]>([]);
  const registerContainer = useCallback((container: HTMLElement) => {
    setContainers(current => [...current.filter(value => value !== container), container]);
    return () => setContainers(current => current.filter(value => value !== container));
  }, []);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(message: string, error = false) {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, error });
    timer.current = setTimeout(() => setToast(null), 4500);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const region = <div className="toast-region" aria-live="polite">{toast && <div className={`toast ${toast.error ? "toast-error" : ""}`}><Icon name={toast.error ? "x" : "check"} size={18}/><span>{toast.message}</span><button type="button" onClick={() => setToast(null)} aria-label="Fechar aviso"><Icon name="x" size={16}/></button></div>}</div>;
  // Native modal dialogs live above every ordinary z-index. Keep feedback inside
  // the active dialog so it is visible and remains part of its accessible scope.
  const container = containers.at(-1);
  return <ToastContext.Provider value={notify}><ToastContainerContext.Provider value={registerContainer}>{children}{container ? createPortal(region, container) : region}</ToastContainerContext.Provider></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
export const useToastContainer = () => useContext(ToastContainerContext);

export function Avatar({ person, size = 28, className = "" }: { person: Pick<Person, "name" | "avatar">; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = person.name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("");
  return <span className={`avatar ${className}`} style={{ "--avatar-default-size": `${size}px` } as CSSProperties} role="img" aria-label={person.name}>{person.avatar && !failed ? <img src={person.avatar} alt="" width={size} height={size} onError={() => setFailed(true)}/> : initials}</span>;
}

export function LikeButton({ id, initialLikes, initialLiked, full = false, action, observedAt }: { id: string; initialLikes: number; initialLiked: boolean; full?: boolean; action?: LikeAction; observedAt?: number }) {
  const { liked, likes, pending, error, toggle } = useProjectLike(id, initialLiked, initialLikes, action, observedAt);
  const notify = useToast();
  const reported = useRef<string | null>(null);
  useEffect(() => { if (error && reported.current !== error) notify(error, true); reported.current = error; }, [error, notify]);
  return <button className={`like-button ${liked ? "is-liked" : ""} ${full ? "like-full" : ""}`} type="button" onClick={toggle} aria-busy={pending} aria-pressed={liked} aria-label={`${liked ? "Descurtir" : "Curtir"} projeto, ${likes} curtidas`}><Icon name="heart" size={full ? 19 : 16}/>{full && <span>{liked ? "Curtido" : "Curtir"}</span>}<span className="like-count">{likes}</span></button>;
}
