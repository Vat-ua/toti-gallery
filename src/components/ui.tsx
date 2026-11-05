"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./icon";
import { useProjectLike } from "./use-project-like";
import type { Person } from "@/lib/types";

const ToastContext = createContext<(message: string, error?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(message: string, error = false) {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, error });
    timer.current = setTimeout(() => setToast(null), 4500);
  }
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return <ToastContext.Provider value={notify}>{children}<div className="toast-region" aria-live="polite">{toast && <div className={`toast ${toast.error ? "toast-error" : ""}`}><Icon name={toast.error ? "x" : "check"} size={18}/><span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Fechar aviso"><Icon name="x" size={16}/></button></div>}</div></ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);

export function Avatar({ person, size = 28, className = "" }: { person: Pick<Person, "name" | "avatar">; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const initials = person.name.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("");
  return <span className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * .33 }} role="img" aria-label={person.name}>{person.avatar && !failed ? <img src={person.avatar} alt="" width={size} height={size} onError={() => setFailed(true)}/> : initials}</span>;
}

export function LikeButton({ id, initialLikes, initialLiked, full = false }: { id: string; initialLikes: number; initialLiked: boolean; full?: boolean }) {
  const { liked, likes, pending, error, toggle } = useProjectLike(id, initialLiked, initialLikes);
  const notify = useToast();
  const reported = useRef<string | null>(null);
  useEffect(() => { if (error && reported.current !== error) notify(error, true); reported.current = error; }, [error, notify]);
  return <button className={`like-button ${liked ? "is-liked" : ""} ${full ? "like-full" : ""}`} type="button" onClick={toggle} aria-busy={pending} aria-pressed={liked} aria-label={`${liked ? "Descurtir" : "Curtir"} projeto, ${likes} curtidas`}><Icon name="heart" size={full ? 19 : 16}/>{full && <span>{liked ? "Curtido" : "Curtir"}</span>}<span className="like-count">{likes}</span></button>;
}
