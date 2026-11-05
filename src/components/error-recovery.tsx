"use client";

import { Icon } from "./icon";

export function ErrorRecovery({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error && typeof error === "object" && "digest" in error && typeof error.digest === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(error.digest) ? error.digest : null;
  return <main id="conteudo" className="container error-page">
    <span className="empty-icon"><Icon name="code" size={32}/></span>
    <h1>Até as boas ideias precisam de uma pausa.</h1>
    <p>Não conseguimos carregar esta página agora. Tente novamente em alguns instantes.</p>
    {digest && <p className="error-reference">Referência: {digest}</p>}
    <div className="error-page-actions">
      <button className="button button-dark" onClick={retry}>Tentar novamente<Icon name="arrow-right" size={16}/></button>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Full navigation can recover a failed root layout. */}
      <a href="/" className="button button-outline">Voltar para a galeria</a>
    </div>
  </main>;
}
