"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COHORTS } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";

export function AuthForm({ nextPath, initialRegister = false }: { nextPath: string; initialRegister?: boolean }) {
  const router = useRouter();
  const notify = useToast();
  const [register, setRegister] = useState(initialRegister);
  const [pending, setPending] = useState(false);
  const [demoPending, setDemoPending] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  async function authenticate(payload: Record<string, unknown>, demo = false) {
    setError(""); setPending(true); setDemoPending(demo);
    try {
      const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível entrar. Tente novamente.");
      notify(payload.action === "register" ? "Boas-vindas! Sua próxima ideia já tem um lugar." : `Que bom ter você por aqui, ${data.user.name.split(" ")[0]}!`);
      router.push(nextPath); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente."); setPending(false); setDemoPending(false); }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    void authenticate({ ...data, action: register ? "register" : "login" });
  }
  return <main id="conteudo" className="container auth-page"><section className="auth-story"><div><span className="eyebrow"><span className="eyebrow-dot"/> TODO COMEÇO CONTA</span><h2>Seu código.<br/>Sua história.<br/><span>Um mundo de<br/>possibilidades.</span></h2><p>Mais do que projetos, compartilhamos caminhos. Faça parte de uma comunidade que aprende, cria e cresce junto.</p></div><span className="auth-decoration" aria-hidden="true">✳</span><div className="auth-story-bottom"><span className="avatar-stack">{[{ name: "Sofia Martins", avatar: "/images/sofia.jpg" }, { name: "Jean Pierre", avatar: "/images/jean.jpg" }, { name: "Camila Rodrigues", avatar: "/images/camila.jpg" }].map(p => <Avatar key={p.name} person={p} size={35}/>)}</span><p>Diferentes histórias.<br/><strong>Um futuro em construção.</strong></p></div></section><section className="auth-form-section"><h1>{register ? "Comece sua história." : "Que bom ter você aqui."}</h1><p>{register ? "Crie sua conta para compartilhar projetos e fazer parte dessa comunidade." : "Entre para compartilhar suas ideias e continuar construindo seu caminho."}</p>{error && <div className="form-error" role="alert"><Icon name="x" size={16}/>{error}</div>}<form onSubmit={submit}>{register && <div className="form-field"><label htmlFor="auth-name">Como podemos chamar você?</label><input id="auth-name" name="name" placeholder="Seu nome completo" autoComplete="name" required minLength={2} maxLength={70} disabled={pending}/></div>}<div className="form-field"><label htmlFor="auth-email">Seu e-mail</label><input id="auth-email" name="email" type="email" placeholder="voce@exemplo.com" autoComplete="email" required maxLength={254} disabled={pending}/></div><div className="form-field"><label htmlFor="auth-password">Sua senha</label><div className="password-field"><input id="auth-password" name="password" type={showPassword ? "text" : "password"} placeholder={register ? "Pelo menos 8 caracteres" : "Digite sua senha"} autoComplete={register ? "new-password" : "current-password"} required minLength={8} maxLength={128} disabled={pending}/><button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><Icon name="eye" size={17}/></button></div></div>{register && <div className="form-row"><div className="form-field"><label htmlFor="auth-cohort">Sua turma</label><select id="auth-cohort" name="cohort" defaultValue="Turma 25" required disabled={pending}>{COHORTS.map(cohort => <option key={cohort}>{cohort}</option>)}</select></div><div className="form-field"><label htmlFor="auth-year">Ano de formação</label><select id="auth-year" name="year" defaultValue="2025" required disabled={pending}>{[2026, 2025, 2024, 2023, 2022, 2021, 2020].map(year => <option key={year}>{year}</option>)}</select></div></div>}<button type="submit" className="button button-dark auth-submit" disabled={pending}>{pending && !demoPending ? <><Icon name="loader" className="spinner" size={17}/>Um instante...</> : <>{register ? "Criar minha conta" : "Entrar na minha conta"}<Icon name="arrow-right" size={17}/></>}</button>{register && <p className="form-help">Seu perfil e seus projetos serão públicos.<br/>Seu e-mail e sua senha permanecem privados.</p>}</form><p className="auth-switch">{register ? "Já faz parte da comunidade?" : "Ainda não tem uma conta?"} <button type="button" disabled={pending} onClick={() => { setRegister(!register); setError(""); }}>{register ? "Entre aqui" : "Faça parte"}<span aria-hidden="true"> ↗</span></button></p><div className="auth-divider">só quer conhecer?</div><button className="button demo-login" type="button" disabled={pending} onClick={() => authenticate({ action: "login", email: "demo@toti.gallery", password: "TotiGaleria2025!" }, true)}><Icon name={demoPending ? "loader" : "code"} className={demoPending ? "spinner" : ""} size={17}/>{demoPending ? "Preparando sua visita..." : "Experimentar com a conta demo"}<Icon name="arrow-up-right" size={15}/></button><p className="demo-hint">Explore como Ana Souza, sem precisar se cadastrar.<br/>A conta é compartilhada. Não adicione dados pessoais.</p></section></main>;
}
