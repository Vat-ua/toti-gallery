"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Person } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";

export function Logo() {
  return <Link href="/" className="brand" aria-label="Toti Gallery, página inicial"><span className="wordmark">toti<span className="brand-dot"/></span><span className="brand-divider"/><span className="brand-gallery">gallery</span></Link>;
}
export function Header({ user }: { user: Person | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); setMenu(false); }, [pathname]);
  useEffect(() => {
    function outside(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); setMenu(false); } }
    document.addEventListener("click", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", outside); document.removeEventListener("keydown", escape); };
  }, []);
  async function logout() {
    setLoggingOut(true);
    try { const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }); if (!response.ok) throw new Error(); setOpen(false); router.push("/"); router.refresh(); notify("Você saiu da sua conta. Até logo!"); }
    catch { notify("Não foi possível sair. Tente novamente.", true); }
    finally { setLoggingOut(false); }
  }
  return <header className="site-header"><div className="container header-inner"><Logo/><nav className="desktop-nav" aria-label="Navegação principal"><Link className={pathname === "/" ? "nav-active" : ""} href="/">Explorar<span className="nav-dot"/></Link><Link className={pathname === "/comunidade" ? "nav-active" : ""} href="/comunidade">A comunidade</Link>{user && <Link className={pathname.startsWith("/meus-projetos") ? "nav-active" : ""} href="/meus-projetos">Meus projetos</Link>}</nav><div className="header-actions">{user ? <div className="user-dropdown" ref={ref}><button className="user-trigger" aria-expanded={open} aria-label="Abrir menu da conta" onClick={() => setOpen(!open)}><Avatar person={user} size={31}/><span>{user.name.split(" ")[0]}</span><Icon name="chevron-down" size={14}/></button>{open && <div className="dropdown-menu account-menu"><div className="account-menu-heading"><strong>{user.name}</strong><span>{user.cohort} · {user.year}</span></div><Link href={`/pessoas/${user.id}`}><Icon name="users" size={17}/>Meu perfil público</Link><Link href="/meus-projetos"><Icon name="grid" size={17}/>Meus projetos</Link><button onClick={logout} disabled={loggingOut}><Icon name="logout" size={17}/>{loggingOut ? "Saindo..." : "Sair da conta"}</button></div>}</div> : <Link href="/entrar" className="login-link">Entrar<Icon name="arrow-up-right" size={15}/></Link>}<Link href="/meus-projetos/novo" className="button button-dark header-publish"><span>Compartilhar projeto</span><Icon name="plus" size={18}/></Link><button className="mobile-menu-button" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? "x" : "menu"}/></button></div></div>{menu && <nav className="mobile-nav" aria-label="Navegação no celular"><Link href="/">Explorar projetos</Link><Link href="/comunidade">A comunidade</Link><Link href="/meus-projetos">Meus projetos</Link><Link href="/meus-projetos/novo">Compartilhar projeto <Icon name="plus" size={17}/></Link></nav>}</header>;
}

export function Footer() {
  return <footer className="site-footer"><div className="container footer-inner"><div><Logo/><p>Histórias diferentes. Um futuro em construção.</p></div><div className="footer-right"><span>Uma iniciativa da <a href="https://totidiversidade.com.br/" target="_blank" rel="noopener noreferrer">Toti <Icon name="arrow-up-right" size={13}/></a></span><span className="footer-made">Feito de código e de gente. <span aria-hidden="true">✳</span></span></div></div></footer>;
}
