"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ owner }: { owner: boolean }) {
  const pathname = usePathname();
  return <nav className="admin-nav" aria-label="Administração">
    <Link href="/admin/turmas" aria-current={pathname.startsWith("/admin/turmas") ? "page" : undefined}>Turmas</Link>
    <Link href="/admin/estudantes" aria-current={pathname.startsWith("/admin/estudantes") ? "page" : undefined}>Estudantes</Link>
    <Link href="/admin/projetos" aria-current={pathname.startsWith("/admin/projetos") ? "page" : undefined}>Projetos</Link>
    {owner && <Link href="/admin/administradores" aria-current={pathname.startsWith("/admin/administradores") ? "page" : undefined}>Administradores</Link>}
  </nav>;
}
