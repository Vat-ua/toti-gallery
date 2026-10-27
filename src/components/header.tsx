"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Person } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { useDropdownPosition } from "./use-dropdown-position";

export function Logo() {
  return <Link href="/" className="brand" aria-label="Toti Gallery, página inicial"><span className="brand-mark" aria-hidden="true">✳</span><span className="brand-word">toti</span>{" "}<span className="brand-gallery">gallery</span></Link>;
}
export function Header({ user }: { user: Person | null }) {
  const pathname = usePathname();
  return <HeaderContent key={pathname} user={user} pathname={pathname}/>;
}
function HeaderContent({ user, pathname }: { user: Person | null; pathname: string }) {
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  useDropdownPosition(open, ref, accountMenuRef);
  useEffect(() => {
    function outside(event: MouseEvent) { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") { setOpen(false); setMenu(false); } }
    document.addEventListener("click", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", outside); document.removeEventListener("keydown", escape); };
  }, []);
  async function logout() {
    setLoggingOut(true);
    try { const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); if (!response.ok) throw new Error(); setOpen(false); router.push("/"); router.refresh(); notify("Você saiu da conta."); }
    catch { notify("Não foi possível sair. Tente novamente.", true); }
    finally { setLoggingOut(false); }
  }
  return <header className="site-header"><div className="container header-inner"><Logo/><nav className="desktop-nav" aria-label="Navegação principal"><Link className={pathname === "/" ? "nav-active" : ""} href="/">Explorar</Link><Link className={pathname.startsWith("/comunidade") || pathname.startsWith("/pessoas") ? "nav-active" : ""} href="/comunidade">Comunidade</Link>{user && <Link className={pathname.startsWith("/meus-projetos") ? "nav-active" : ""} href="/meus-projetos">Meus projetos</Link>}</nav><div className="header-actions"><ThemeToggle/>{user ? <div className="user-dropdown" ref={ref}><button className="user-trigger" aria-expanded={open} aria-label="Abrir menu da conta" onClick={() => setOpen(!open)}><Avatar person={user} size={34}/><span>{user.name.split(" ")[0]}</span><Icon name="chevron-down" size={15}/></button>{open && <div className="dropdown-menu account-menu" ref={accountMenuRef}><div className="account-menu-heading"><strong>{user.name}</strong></div><Link href={`/pessoas/${user.id}`}><Icon name="users" size={18}/>Meu perfil</Link><Link href="/meus-projetos"><Icon name="grid" size={18}/>Meus projetos</Link><button onClick={logout} disabled={loggingOut}><Icon name="logout" size={18}/>{loggingOut ? "Saindo..." : "Sair da conta"}</button></div>}</div> : <Link href="/entrar" className="login-link" aria-label="Entrar" title="Entrar"><Icon name="user" size={20}/></Link>}<Link href="/meus-projetos/novo" className="button button-dark header-publish" aria-label="Publicar projeto" title="Publicar projeto"><Icon name="plus" size={21}/></Link><button className="mobile-menu-button" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? "x" : "menu"} size={22}/></button></div></div>{menu && <nav className="mobile-nav" aria-label="Navegação no celular"><Link href="/">Explorar</Link><Link href="/comunidade">Comunidade</Link><Link href="/meus-projetos">Meus projetos</Link><Link className="mobile-publish" href="/meus-projetos/novo">Publicar projeto <Icon name="plus" size={18}/></Link></nav>}</header>;
}

export function Footer({ user }: { user: Person | null }) {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo/>
          <p>Galeria de projetos da comunidade da <a href="https://totidiversidade.com.br/" target="_blank" rel="noopener noreferrer">Toti Diversidade <Icon name="arrow-up-right" size={13}/></a>.</p>
        </div>
        <nav className="footer-nav" aria-label="Links do rodapé">
          <div>
            <span>Conhecer</span>
            <Link href="/">Projetos</Link>
            <Link href="/comunidade">Comunidade</Link>
          </div>
          <div>
            <span>Participar</span>
            {user ? <Link href="/meus-projetos">Meus projetos</Link> : <Link href="/entrar">Entrar</Link>}
            <Link href="/meus-projetos/novo">Publicar projeto</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
