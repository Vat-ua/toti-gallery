"use client";

import { Icon } from "./icon";

export function CollectionFeedback({ error, retry, pending, hasItems }: { error: string; retry: () => void; pending: boolean; hasItems: boolean }) {
  if (error) return <div className="collection-feedback"><p className="form-error" role="alert">{error}</p><button type="button" className="button button-outline" onClick={retry}>Tentar novamente</button></div>;
  if (!pending) return null;
  return <div className={hasItems ? "sr-only" : "collection-loading"} role="status" aria-busy="true"><Icon name="loader" size={18} className="spinner"/>Carregando resultados…</div>;
}
