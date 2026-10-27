"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ owner }: { owner: boolean }) {
  const pathname = usePathname();
  return <nav className="admin-nav" aria-label="Administração">
    <Link href="/admin/turmas" aria-current={pathname.startsWith("/admin/turmas") ? "page" : undefined}>Turmas</Link>
    <Link href="/admin/estudantes" aria-current={pathname.startsWith("/admin/estudantes") ? "page" : undefined}>Estudantes</Link>
    <span aria-disabled="true" title="Disponível na próxima etapa">Projetos <small>Em breve</small></span>
    {owner && <span aria-disabled="true" title="Disponível na próxima etapa">Administradores <small>Em breve</small></span>}
  </nav>;
}
