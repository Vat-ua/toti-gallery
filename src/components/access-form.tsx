"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "./icon";
import { GoogleSignIn } from "./google-sign-in";

export function AccessForm({ googleEnabled }: { googleEnabled: boolean }) {
  const token = useRef("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [grant, setGrant] = useState<{ email: string; purpose: "activation" | "password_reset" } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let controller: AbortController;
    async function load(value: string) {
      controller?.abort();
      const current = new AbortController(); controller = current;
      token.current = value;
      window.history.replaceState(null, "", "/acesso");
      try {
        await Promise.resolve();
        if (current.signal.aborted) return;
        setGrant(null); setDone(false); setError(""); setLoading(true); setPending(false); setGooglePending(false);
        if (!value) throw new Error("Abra o link completo recebido da administração. Se já o usou, solicite um novo link.");
        const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inspect", token: value }), signal: current.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Este link não está disponível.");
        if (!current.signal.aborted) setGrant(data);
      } catch (error) { if (!current.signal.aborted) setError(error instanceof Error ? error.message : "Não foi possível verificar o link. Tente novamente."); }
      finally { if (!current.signal.aborted) setLoading(false); }
    }
    const readToken = () => new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    const changed = () => { void load(readToken()); };
    void load(readToken() || token.current);
    window.addEventListener("hashchange", changed);
    return () => { controller.abort(); window.removeEventListener("hashchange", changed); };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    if (!token.current) { setError("Abra o link completo recebido da administração. Se já o usou, solicite um novo link."); return; }
    if (form.get("password") !== form.get("confirmPassword")) { setError("A confirmação não corresponde à senha."); return; }
    const submittedToken = token.current;
    setPending(true);
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, password: form.get("password"), confirmPassword: form.get("confirmPassword") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível definir sua senha.");
      if (token.current !== submittedToken) return;
      token.current = ""; setDone(true);
    } catch (err) { if (token.current === submittedToken) setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente."); }
    finally { if (token.current === submittedToken || !token.current) setPending(false); }
  }

  const activation = grant?.purpose === "activation";
  return <main id="conteudo" className="container access-page"><section className="auth-form-section">
    <h1>{done ? "Senha definida" : loading ? "Verificando acesso" : activation ? "Ative sua conta" : grant ? "Definir senha" : "Acesso à conta"}</h1>
    {done ? <><p>Sua conta está pronta. Entre com seu email e a senha que acabou de definir.</p><Link href="/entrar" className="button button-dark auth-submit">Entrar<Icon name="arrow-right" size={17}/></Link></> : <>
      {loading && <p role="status">Verificando seu link...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {grant ? <>
        <p>{activation ? googleEnabled ? "Entre com Google ou crie uma senha para começar." : "Crie uma senha para começar." : "Escolha uma nova senha para acessar sua conta."}</p>
        <p className="access-email">{grant.email}</p>
        {activation && googleEnabled && <><GoogleSignIn activationToken={() => token.current} disabled={pending} onError={setError} onPending={setGooglePending}/><div className="auth-divider">ou crie uma senha</div></>}
        <form onSubmit={submit} method="post" action="/api/access"><fieldset className="account-fieldset" disabled={pending || googlePending}>
          <div className="form-field"><label htmlFor="access-password">{activation ? "Criar senha" : "Nova senha"}</label><input id="access-password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} aria-describedby="access-password-help"/><small id="access-password-help">Use de 15 a 128 caracteres. Uma frase longa é uma boa opção.</small></div>
          <div className="form-field"><label htmlFor="access-confirm">Confirmar senha</label><input id="access-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={15} maxLength={128}/></div>
          <button className="button button-dark auth-submit" type="submit">{pending ? "Salvando..." : activation ? "Ativar com senha" : "Salvar senha"}<Icon name="arrow-right" size={17}/></button>
        </fieldset></form>
        {!activation && <Link className="access-back" href="/entrar">Voltar para entrar</Link>}
      </> : !loading && <Link className="button button-outline auth-submit" href="/entrar">Voltar para entrar<Icon name="arrow-right" size={17}/></Link>}
    </>}
  </section></main>;
}
