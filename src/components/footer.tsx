import Link from "next/link";
import type { Person } from "@/lib/types";
import { Icon } from "./icon";
import { Logo } from "./logo";

export function Footer({
  user,
  demo = false,
  presentationEnabled,
}: {
  user: Person | null;
  demo?: boolean;
  presentationEnabled: boolean;
}) {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>
            Galeria de projetos da comunidade da{" "}
            <a
              href="https://totidiversidade.com.br/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Toti Diversidade <Icon name="arrow-up-right" size={13} />
            </a>
          </p>
        </div>
        <nav className="footer-nav" aria-label="Links do rodapé">
          <div>
            <span>Conhecer</span>
            <Link href="/">Projetos</Link>
            <Link href="/comunidade">Comunidade</Link>
            <Link href="/sobre">Sobre</Link>
            {presentationEnabled && (
              <Link href="/apresentacao">Apresentação</Link>
            )}
          </div>
          <div>
            <span>Participar</span>
            {user ? (
              <Link href={demo ? "/demo" : "/meus-projetos"}>
                Meus projetos
              </Link>
            ) : (
              <Link href="/entrar">Entrar</Link>
            )}
            <Link href={demo ? "/demo/novo" : "/meus-projetos/novo"}>
              Publicar projeto
            </Link>
          </div>
        </nav>
      </div>
    </footer>
  );
}
