"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon } from "@/components/icon";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main id="conteudo" className="container error-page"><span className="empty-icon"><Icon name="code" size={32}/></span><h1>Até as boas ideias precisam de uma pausa.</h1><p>Não conseguimos carregar esta página agora. Tente novamente em alguns instantes.</p><div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}><button className="button button-dark" onClick={reset}>Tentar novamente<Icon name="arrow-right" size={16}/></button><Link href="/" className="button button-outline">Voltar para a galeria</Link></div></main>;
}
