"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icon";

export function AccessForm() {
  const token = useRef("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (token.current) return;
    token.current = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    // Keep the bearer token out of requests, referrers, browser history and the DOM.
    window.history.replaceState(null, "", "/acesso");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    if (!token.current) { setError("Abra o link completo recebido da administração. Se já o usou, solicite um novo link."); return; }
    if (form.get("password") !== form.get("confirmPassword")) { setError("A confirmação não corresponde à senha."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, password: form.get("password"), confirmPassword: form.get("confirmPassword") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível definir sua senha.");
      token.current = ""; setDone(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente."); }
    finally { setPending(false); }
  }

  return <main id="conteudo" className="container access-page"><section className="auth-form-section">
    <h1>{done ? "Senha definida" : "Definir senha"}</h1>
    {done ? <><p>Sua conta está pronta. Entre com seu email e a senha que acabou de definir.</p><Link href="/entrar" className="button button-dark auth-submit">Entrar<Icon name="arrow-right" size={17}/></Link></> : <>
      <p>Escolha uma senha para acessar sua conta. Este link só pode ser usado uma vez.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={submit} method="post" action="/api/access"><fieldset className="account-fieldset" disabled={pending}>
        <div className="form-field"><label htmlFor="access-password">Senha</label><input id="access-password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} aria-describedby="access-password-help"/><small id="access-password-help">Use de 15 a 128 caracteres. Uma frase longa é uma boa opção.</small></div>
        <div className="form-field"><label htmlFor="access-confirm">Confirmar senha</label><input id="access-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={15} maxLength={128}/></div>
        <button className="button button-dark auth-submit" type="submit">{pending ? "Salvando..." : "Salvar senha"}<Icon name="arrow-right" size={17}/></button>
      </fieldset></form>
    </>}
  </section></main>;
}
