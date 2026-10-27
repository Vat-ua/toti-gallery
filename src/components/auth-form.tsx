"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icon";
import { useToast } from "./ui";

export function AuthForm({ nextPath, googleEnabled, initialError }: { nextPath: string; googleEnabled: boolean; initialError: string }) {
  const router = useRouter();
  const notify = useToast();
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState(initialError);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setPending("email");
    const fields = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/sign-in/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: String(fields.get("email") || "").trim().toLowerCase(), password: fields.get("password") }) });
      const data = await response.json();
      if (!response.ok) throw new Error(response.status === 429 ? "Muitas tentativas. Aguarde um minuto e tente novamente." : "Não foi possível entrar. Confira seu email e sua senha ou fale com a administração.");
      notify(`Olá, ${data.user.name.split(" ")[0]}!`);
      router.push(nextPath); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente."); setPending(null); }
  }

  async function google() {
    setError(""); setPending("google");
    try {
      const response = await fetch("/api/auth/sign-in/social", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "google", callbackURL: nextPath, errorCallbackURL: "/entrar", disableRedirect: true }) });
      const result = await response.json();
      if (!response.ok || !result.url) throw new Error();
      window.location.assign(result.url);
    } catch { setError("Não foi possível acessar o Google. Tente novamente ou entre com email e senha."); setPending(null); }
  }

  return <main id="conteudo" className="container auth-page">
    <section className="auth-story"><div><span className="eyebrow"><span className="eyebrow-dot"/> Área de publicação</span><h2>Compartilhe o que você está <span>construindo.</span></h2><p>Publique seus projetos, descubra ideias e aprenda com outras pessoas.</p><ul className="auth-bullets"><li><Icon name="check" size={17}/>Um perfil para seus projetos</li><li><Icon name="check" size={17}/>Trabalhos individuais e em grupo</li><li><Icon name="check" size={17}/>Conexões entre turmas</li></ul></div><span className="auth-decoration" aria-hidden="true">✳</span></section>
    <section className="auth-form-section">
      <h1>Entrar</h1><p>Use o email cadastrado pela administração.</p>
      {googleEnabled ? <><button className="button button-outline google-login" type="button" disabled={!!pending} onClick={google}>
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.86 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.41 14.41 0 0 1 9.78 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>
        {pending === "google" ? "Conectando..." : "Continuar com Google"}
      </button><div className="auth-divider">ou entre com email</div></> : <p className="auth-help">O acesso com Google ainda está em configuração. Você pode entrar com email e senha.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <form onSubmit={submit} method="post" action="/api/auth/sign-in/email">
        <div className="form-field"><label htmlFor="auth-email">Email</label><input id="auth-email" name="email" type="email" autoComplete="username" required maxLength={254} disabled={!!pending}/></div>
        <div className="form-field"><label htmlFor="auth-password">Senha</label><div className="password-field"><input id="auth-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required maxLength={128} disabled={!!pending}/><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={17}/></button></div></div>
        <button type="submit" className="button button-dark auth-submit" disabled={!!pending}>{pending === "email" ? "Entrando..." : "Entrar com email"}<Icon name="arrow-right" size={17}/></button>
      </form>
      <details className="auth-help"><summary>Esqueci minha senha</summary><p>Peça à administração um novo link para definir sua senha. O link será enviado manualmente ao seu email cadastrado.</p></details>
      <p className="auth-help">Ainda não ativou sua conta? Use seu Google cadastrado ou o link de ativação recebido da administração.</p>
    </section>
  </main>;
}
