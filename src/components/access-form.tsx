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
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
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
        setGrant(null); setDone(false); setError(""); setFieldErrors({}); setLoading(true); setPending(false); setGooglePending(false);
        if (!value) { setError("Abra o link completo recebido da administração. Se já o usou, solicite um novo link."); return; }
        const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "inspect", token: value }), signal: current.signal });
        const data = await response.json().catch(() => null);
        if (current.signal.aborted) return;
        if (!response.ok || !data?.email) { setError(data?.error || "Não foi possível verificar o link. Tente novamente em instantes."); return; }
        if (!current.signal.aborted) setGrant(data);
      } catch { if (!current.signal.aborted) setError("Não foi possível conectar. Confira sua conexão e abra novamente o link completo."); }
      finally { if (!current.signal.aborted) setLoading(false); }
    }
    const readToken = () => new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
    const changed = () => { void load(readToken()); };
    void load(readToken() || token.current);
    window.addEventListener("hashchange", changed);
    return () => { controller.abort(); window.removeEventListener("hashchange", changed); };
  }, []);

  function clearFieldError(field: "password" | "confirmPassword") {
    setFieldErrors(current => ({ ...current, [field]: undefined, ...(field === "password" ? { confirmPassword: undefined } : {}) }));
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    if (!token.current) { setError("Abra o link completo recebido da administração. Se já o usou, solicite um novo link."); return; }
    const password = String(form.get("password") || "");
    const confirmation = String(form.get("confirmPassword") || "");
    const errors = {
      password: !password ? "Crie uma senha para continuar." : password.length < 15 || password.length > 128 ? "Use uma senha de 15 a 128 caracteres." : undefined,
      confirmPassword: !confirmation ? "Repita a senha para confirmar." : password !== confirmation ? "As senhas não coincidem." : undefined,
    };
    setFieldErrors(errors);
    if (errors.password || errors.confirmPassword) {
      (event.currentTarget.elements.namedItem(errors.password ? "password" : "confirmPassword") as HTMLInputElement).focus();
      return;
    }
    const submittedToken = token.current;
    setPending(true);
    try {
      const response = await fetch("/api/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token.current, password: form.get("password"), confirmPassword: form.get("confirmPassword") }) });
      const result = await response.json().catch(() => null);
      if (token.current !== submittedToken) return;
      if (!response.ok || !result?.ok) { setError(result?.error || "Não foi possível definir sua senha. Tente novamente em instantes."); return; }
      token.current = ""; setDone(true);
    } catch { if (token.current === submittedToken) setError("Não foi possível conectar. Confira sua conexão e tente novamente."); }
    finally { if (token.current === submittedToken || !token.current) setPending(false); }
  }

  const activation = grant?.purpose === "activation";
  return <main id="conteudo" className="container access-page"><section className="auth-form-section">
    <h1>{done ? "Senha definida" : loading ? "Verificando acesso" : activation ? "Ative sua conta" : grant ? "Definir senha" : "Acesso à conta"}</h1>
    {done ? <><p>Entre com <strong className="access-email">{grant?.email}</strong> e a senha que você acabou de criar.</p><Link href={`/entrar#${new URLSearchParams({ email: grant?.email || "" })}`} className="button button-dark auth-submit">Entrar<Icon name="arrow-right" size={17}/></Link></> : <>
      {loading && <p role="status">Verificando seu link...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {grant ? <>
        <p>{activation ? googleEnabled ? "Entre com Google ou crie uma senha para começar." : "Crie uma senha para começar." : "Escolha uma nova senha para acessar sua conta."}</p>
        <p className="access-email">{grant.email}</p>
        {activation && googleEnabled && <><GoogleSignIn activationToken={() => token.current} disabled={pending} onError={setError} onPending={setGooglePending}/><div className="auth-divider">ou crie uma senha</div></>}
        <form onSubmit={submit} method="post" action="/api/access" noValidate><fieldset className="account-fieldset" disabled={pending || googlePending}>
          <div className="form-field"><label htmlFor="access-password">{activation ? "Criar senha" : "Nova senha"}</label><input id="access-password" name="password" type="password" autoComplete="new-password" required minLength={15} maxLength={128} aria-invalid={!!fieldErrors.password} aria-describedby={`access-password-help${fieldErrors.password ? " access-password-error" : ""}`} onChange={() => clearFieldError("password")}/><small id="access-password-help">Use de 15 a 128 caracteres. Uma frase longa é uma boa opção.</small>{fieldErrors.password && <p id="access-password-error" className="field-error" role="alert">{fieldErrors.password}</p>}</div>
          <div className="form-field"><label htmlFor="access-confirm">Confirmar senha</label><input id="access-confirm" name="confirmPassword" type="password" autoComplete="new-password" required minLength={15} maxLength={128} aria-invalid={!!fieldErrors.confirmPassword} aria-describedby={fieldErrors.confirmPassword ? "access-confirm-error" : undefined} onChange={() => clearFieldError("confirmPassword")}/>{fieldErrors.confirmPassword && <p id="access-confirm-error" className="field-error" role="alert">{fieldErrors.confirmPassword}</p>}</div>
          <button className="button button-dark auth-submit" type="submit">{pending ? "Salvando..." : activation ? "Ativar com senha" : "Salvar senha"}<Icon name="arrow-right" size={17}/></button>
        </fieldset></form>
        {!activation && <Link className="access-back" href="/entrar">Voltar para entrar</Link>}
      </> : !loading && <Link className="button button-outline auth-submit" href="/entrar">Voltar para entrar<Icon name="arrow-right" size={17}/></Link>}
    </>}
  </section></main>;
}
