"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./icon";
import { accessMessage, formatAccessExpiry } from "@/lib/access-message";

export function Dialog({ title, context, description, children, close, busy = false, drawer = false }: { title: string; context?: string; description?: string; children: ReactNode; close: () => void; busy?: boolean; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current!; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; dialog.showModal(); return () => { dialog.close(); document.body.style.overflow = previous; }; }, []);
  return createPortal(<dialog ref={ref} className={`admin-dialog ${drawer ? "admin-drawer" : ""}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClick={event => {
    if (event.target !== event.currentTarget || busy) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  }}>
    <div className="admin-dialog-heading"><div>{context && <p className="admin-dialog-context">{context}</p>}<h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Fechar"><Icon name="x"/></button></div>
    {children}
  </dialog>, document.body);
}
export function ErrorText({ text }: { text: string }) { return text ? <p className="form-error" role="alert">{text}</p> : null; }
export function Search({ value, change, placeholder }: { value: string; change: (value: string) => void; placeholder: string }) {
  return <div className="search-field admin-search"><Icon name="search" size={19}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => change(e.target.value)}/>{value && <button type="button" onClick={() => change("")} aria-label="Limpar busca"><Icon name="x" size={17}/></button>}</div>;
}
export type Grant = { url: string; expiresAt: string };
export function AccessLinkBox({ grant, name, activation }: { grant: Grant; name: string; activation: boolean }) {
  const id = useId(), ref = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false), [error, setError] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(accessMessage(name, grant.url, grant.expiresAt, activation)); setCopied(true); setError(""); }
    catch { ref.current?.select(); setError("Selecione e copie o link manualmente."); }
  }
  return <div className="admin-generated-link"><label htmlFor={id}>Link pessoal</label><input id={id} ref={ref} readOnly value={grant.url} onFocus={e => e.target.select()}/><small>Válido até {formatAccessExpiry(grant.expiresAt)} (horário de Brasília). Exibido apenas agora; um novo link substitui o anterior.</small><button type="button" className="button button-dark" onClick={copy}><Icon name={copied ? "check" : "mail"} size={17}/>{copied ? "Mensagem copiada" : activation ? "Copiar mensagem de ativação" : "Copiar mensagem"}</button><ErrorText text={error}/></div>;
}
