"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, Project } from "@/lib/types";
import { ProjectCard } from "./project-card";
import { Icon } from "./icon";
import { useToast } from "./ui";

export function MyProjects({ projects, user }: { projects: Project[]; user: Person }) {
  const [list, setList] = useState({ source: projects, items: projects });
  const items = list.items;
  if (list.source !== projects) setList({ source: projects, items: projects });
  const [target, setTarget] = useState<Project | null>(null);
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const notify = useToast();
  const router = useRouter();
  useEffect(() => { if (target) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [target]);
  const removingPublication = target?.author.id === user.id;
  async function remove() {
    if (!target) return;
    setPending(true);
    try {
      const response = await fetch(`/api/projects/${target.id}${removingPublication ? "" : "/authors/me"}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setList(current => ({ ...current, items: current.items.filter(item => item.id !== target.id) })); setTarget(null);
      notify(removingPublication ? "Projeto excluído." : "Você saiu do projeto. Ele continua disponível para os outros autores."); router.refresh();
    } catch (err) { notify(err instanceof Error ? err.message : "Não foi possível excluir o projeto.", true); }
    finally { setPending(false); }
  }
  return <main id="conteudo" className="container inner-page">
    <Link href="/" className="back-link"><Icon name="arrow-left" size={16}/>Projetos</Link>
    <div className="page-heading">
      <div className="page-intro"><h1>Meus projetos</h1><p>As publicações e os projetos em que você participa.</p></div>
      <Link href="/meus-projetos/novo" className="button button-dark"><Icon name="plus" size={17}/>Publicar projeto</Link>
    </div>
    <div className="dashboard-summary">
      <span><strong>{items.length}</strong> {items.length === 1 ? "projeto" : "projetos"}</span>
      <Link href={`/pessoas/${user.id}`}>Ver perfil<Icon name="arrow-up-right" size={16}/></Link>
    </div>
    {items.length ? <div className="management-grid">{items.map(project => {
      const isOwner = project.author.id === user.id;
      const href = project.visibility === "hidden" ? `/meus-projetos/${project.id}` : `/projetos/${project.slug}`;
      return <div key={project.id} className="management-card">
        <ProjectCard project={project} isCoauthor={!isOwner} href={href} readOnly={project.visibility === "hidden"}/>
        {project.visibility === "hidden" && <div className="project-moderation-note"><strong>Oculto pela administração</strong>{isOwner && project.moderationReason && <p>{project.moderationReason}</p>}</div>}
        <div className="management-actions">
          {isOwner && <Link href={`/meus-projetos/${project.id}/editar`}><Icon name="edit" size={15}/>Editar</Link>}
          <Link href={href}><Icon name="eye" size={15}/>Visualizar</Link>
          {isOwner ? <button type="button" aria-label={`Excluir ${project.title}`} onClick={() => setTarget(project)}><Icon name="trash" size={16}/></button> : <button type="button" className="leave-project" onClick={() => setTarget(project)} aria-label={`Sair do projeto ${project.title}`}>Sair do projeto</button>}
        </div>
      </div>;
    })}</div> : <div className="empty-state">
      <span className="empty-icon"><Icon name="code" size={32}/></span>
      <h2>Você ainda não tem projetos.</h2>
      <p>Publique um projeto ou participe como coautor.</p>
      <Link href="/meus-projetos/novo" className="button button-dark"><Icon name="plus" size={17}/>Publicar projeto</Link>
    </div>}
    <dialog ref={dialogRef} className="dialog" aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => { if (pending) event.preventDefault(); else setTarget(null); }} onClick={event => { if (event.target === event.currentTarget && !pending) setTarget(null); }}>
      <span className="dialog-icon"><Icon name={removingPublication ? "trash" : "logout"} size={24}/></span>
      <h2 id="delete-title">{removingPublication ? "Excluir este projeto?" : "Sair deste projeto?"}</h2>
      <p id="delete-description">{removingPublication ? <>O projeto <strong>{target?.title}</strong> será removido da galeria e dos perfis de todos os autores, junto com suas curtidas. Essa ação não pode ser desfeita.</> : <>Você deixará de aparecer como coautor de <strong>{target?.title}</strong>. O projeto e suas curtidas continuarão disponíveis para os outros participantes.</>}</p>
      <div className="dialog-actions">
        <button className="button button-outline" onClick={() => setTarget(null)} disabled={pending} autoFocus>{removingPublication ? "Manter meu projeto" : "Cancelar"}</button>
        <button className="button button-danger" onClick={remove} disabled={pending}>{pending ? <><Icon name="loader" size={15} className="spinner"/>{removingPublication ? "Excluindo..." : "Saindo..."}</> : removingPublication ? "Sim, excluir" : "Sair do projeto"}</button>
      </div>
    </dialog>
  </main>;
}
