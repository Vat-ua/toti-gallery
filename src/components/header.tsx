"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Person } from "@/lib/types";
import { isStaff, type Role } from "@/lib/permissions";
type HeaderUser = Person & { role?: Role };
import { Icon } from "./icon";
import { BrandSymbol } from "./brand-symbol";
import { Avatar, useToast } from "./ui";
import { ThemeToggle } from "./theme-toggle";
import { DropdownMenu, DropdownItem, DropdownLabel } from "./dropdown-menu";

export function Logo({ href = "/" }: { href?: string }) {
  return <Link href={href} className="brand" aria-label="Toti Gallery, página inicial"><span className="brand-mark" aria-hidden="true"><BrandSymbol/></span><span className="brand-word">toti</span>{" "}<span className="brand-gallery">gallery</span></Link>;
}
export function Header({ user, demo = false, onDemoExit }: { user: HeaderUser | null; demo?: boolean; onDemoExit?: () => void }) {
  const pathname = usePathname();
  return <HeaderContent key={pathname} user={user} pathname={pathname} demo={demo} onDemoExit={onDemoExit}/>;
}
function HeaderContent({ user, pathname, demo, onDemoExit }: { user: HeaderUser | null; pathname: string; demo: boolean; onDemoExit?: () => void }) {
  const adminArea = pathname.startsWith("/admin");
  const router = useRouter();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setMenu(false); }
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  async function logout() {
    setLoggingOut(true);
    try { const response = await fetch("/api/auth/sign-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); if (!response.ok) throw new Error(); setOpen(false); router.push("/"); router.refresh(); notify("Você saiu da conta."); }
    catch { notify("Não foi possível sair. Tente novamente.", true); }
    finally { setLoggingOut(false); }
  }
  return <header className="site-header"><div className="container header-inner"><Logo/><nav className="desktop-nav" aria-label="Navegação principal">{adminArea ? <Link href="/">Ver galeria</Link> : <><Link className={pathname === "/" ? "nav-active" : ""} href="/">Explorar</Link><Link className={pathname.startsWith("/comunidade") || pathname.startsWith("/pessoas") || pathname === "/demo/perfil" ? "nav-active" : ""} href="/comunidade">Comunidade</Link>{user && <Link className={(pathname.startsWith("/meus-projetos") || (demo && pathname.startsWith("/demo") && pathname !== "/demo/perfil")) ? "nav-active" : ""} href={demo ? "/demo" : "/meus-projetos"}>Meus projetos</Link>}</>}</nav><div className="header-actions"><ThemeToggle/>{user ? <div className="user-dropdown"><DropdownMenu open={open} onOpenChange={setOpen} className="account-menu"
    trigger={<button type="button" className="user-trigger" aria-label="Abrir menu da conta"><Avatar person={user} size={34}/><span>{user.name.split(" ")[0]}</span><Icon name="chevron-down" size={15}/></button>}>
    <DropdownLabel className="account-menu-heading"><strong>{user.name}</strong></DropdownLabel>
    {user.role && isStaff(user.role) && <DropdownItem asChild><Link className="dropdown-item" href="/admin/turmas"><Icon name="grid" size={18}/>Administração</Link></DropdownItem>}
    <DropdownItem asChild><Link className="dropdown-item" href={demo ? "/demo/perfil" : `/pessoas/${user.slug}`}><Icon name="users" size={18}/>Meu perfil</Link></DropdownItem>
    <DropdownItem asChild><Link className="dropdown-item" href={demo ? "/demo" : "/meus-projetos"}><Icon name="grid" size={18}/>Meus projetos</Link></DropdownItem>
    {demo ? <DropdownItem asChild><Link href="/" prefetch={false} onClick={onDemoExit} className="dropdown-item"><Icon name="logout" size={18}/>Sair da demonstração</Link></DropdownItem> : <DropdownItem asChild disabled={loggingOut} onSelect={event => { event.preventDefault(); void logout(); }}><button type="button" className="dropdown-item" disabled={loggingOut}><Icon name="logout" size={18}/>{loggingOut ? "Saindo..." : "Sair da conta"}</button></DropdownItem>}
    </DropdownMenu></div> : <Link href="/entrar" className="login-link" aria-label="Entrar" title="Entrar"><Icon name="user" size={20}/></Link>}{!adminArea && <Link href={demo ? "/demo/novo" : "/meus-projetos/novo"} className="button button-dark header-publish" aria-label="Publicar projeto" title="Publicar projeto"><Icon name="plus" size={21}/></Link>}<button className="mobile-menu-button" aria-label={menu ? "Fechar menu" : "Abrir menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name={menu ? "x" : "menu"} size={22}/></button></div></div>{menu && <nav className="mobile-nav" aria-label="Navegação no celular">
    {!demo && user?.role && isStaff(user.role) && <Link href="/admin/turmas"><Icon name="grid" size={18}/>Administração</Link>}
    <Link href="/"><Icon name="search" size={18}/>Explorar</Link>
    <Link href="/comunidade"><Icon name="users" size={18}/>Comunidade</Link>
    <Link href={demo ? "/demo" : "/meus-projetos"}><Icon name="grid" size={18}/>Meus projetos</Link>
    <Link className="mobile-publish" href={demo ? "/demo/novo" : "/meus-projetos/novo"}><Icon name="plus" size={18}/>Publicar projeto</Link>
  </nav>}</header>;
}

export function Footer({ user, demo = false }: { user: Person | null; demo?: boolean }) {
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
            <Link href="/">Projetos</Link><Link href="/comunidade">Comunidade</Link>
          </div>
          <div>
            <span>Participar</span>
            {user ? <Link href={demo ? "/demo" : "/meus-projetos"}>Meus projetos</Link> : <Link href="/entrar">Entrar</Link>}<Link href={demo ? "/demo/novo" : "/meus-projetos/novo"}>Publicar projeto</Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
