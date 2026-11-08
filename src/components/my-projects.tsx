"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, ProjectSummary } from "@/lib/types";
import { ProjectCard } from "./project-card";
import { Icon } from "./icon";
import { useToast } from "./ui";
import { deleteProject, leaveProject } from "@/lib/projects-client";
import type { LikeAction } from "@/lib/likes-client";
import type { CollectionSnapshot } from "@/lib/collection-page";
import { usePagedCollection } from "./use-paged-collection";
import { CollectionFeedback } from "./collection-feedback";
import { useGalleryFilters } from "./use-gallery-filters";


import { studentProjectLinks, type ProjectLinks } from "@/lib/project-links";

export type MyProjectsActions = { remove: typeof deleteProject; leave: typeof leaveProject; like?: LikeAction };
const apiActions: MyProjectsActions = { remove: deleteProject, leave: leaveProject };

export function MyProjects({ projects, user, actions = apiActions, links = studentProjectLinks, removalDescription, removalSuccessMessage = "Projeto excluído.", backHref = "/", pagination }: {
  projects: ProjectSummary[]; user: Person; actions?: MyProjectsActions; links?: ProjectLinks; removalDescription?: string; removalSuccessMessage?: string; backHref?: string | null; pagination?: CollectionSnapshot<ProjectSummary>;
}) {
  const initial = useMemo(() => pagination || { items: projects, total: projects.length, loadedPages: 1, pageSize: projects.length, hasMore: false }, [pagination, projects]);
  // Demo passes no pagination and remains entirely local, including data operations.
  const collection = usePagedCollection(initial, pagination ? "/api/projects?view=mine" : null);
  const { changePage } = useGalleryFilters("page");
  const source = collection.data.items;
  const [list, setList] = useState({ source, items: source });
  const items = list.items;
  if (list.source !== source) setList({ source, items: source });
  const total = collection.data.total - (source.length - items.length);
  const [target, setTarget] = useState<ProjectSummary | null>(null);
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
      if (removingPublication) await actions.remove(target.id);
      else await actions.leave(target.id);
      setList(current => ({ ...current, items: current.items.filter(item => item.id !== target.id) })); setTarget(null);
      notify(removingPublication ? removalSuccessMessage : "Você saiu do projeto. Ele continua disponível para os outros autores."); router.refresh();
    } catch (err) { notify(err instanceof Error ? err.message : "Não foi possível excluir o projeto.", true); }
    finally { setPending(false); }
  }
  return <main id="conteudo" className="container inner-page">
    {backHref && <Link href={backHref} className="back-link"><Icon name="arrow-left" size={16}/>Projetos</Link>}
    <div className="page-heading">
      <div className="page-intro"><h1>Meus projetos</h1><p>Projetos publicados por você ou com sua coautoria.</p></div>
      <div className="page-heading-actions">
        <Link href={links.profile(user.slug)} className="button button-outline button-transparent"><Icon name="users" size={18}/>Meu perfil</Link>
        <Link href={links.create} className="button button-dark"><Icon name="plus" size={17}/>Publicar projeto</Link>
      </div>
    </div>
    <div className="dashboard-summary">
      <span><strong>{total}</strong> {total === 1 ? "projeto" : "projetos"}</span>
    </div>
    <CollectionFeedback error={collection.error} retry={collection.retry} pending={collection.pending} hasItems={items.length > 0}/>
    {items.length ? <div className="management-grid" aria-busy={collection.pending}>{items.map(project => {
      const isOwner = project.author.id === user.id;
      const href = links.view(project);
      return <div key={project.id} className="management-card">
        <ProjectCard project={project} isCoauthor={!isOwner} href={href} readOnly={project.visibility === "hidden"} likeAction={actions.like} links={links}/>
        {project.visibility === "hidden" && <div className="project-moderation-note"><strong>Oculto pela administração</strong>{isOwner && project.moderationReason && <p>{project.moderationReason}</p>}</div>}
        <div className="management-actions">
          {isOwner && <Link href={links.edit(project.id)}><Icon name="edit" size={15}/>Editar</Link>}
          <Link href={href}><Icon name="eye" size={15}/>Visualizar</Link>
          {isOwner ? <button type="button" aria-label={`Excluir ${project.title}`} onClick={() => setTarget(project)}><Icon name="trash" size={16}/></button> : <button type="button" className="leave-project" onClick={() => setTarget(project)} aria-label={`Sair do projeto ${project.title}`}>Sair do projeto</button>}
        </div>
      </div>;
    })}</div> : !collection.pending && !collection.error ? <div className="empty-state">
      <span className="empty-icon"><Icon name="code" size={32}/></span>
      <h2>Você ainda não tem projetos.</h2>
      <p>Publique um projeto ou participe como coautor.</p>
      <Link href={links.create} className="button button-dark"><Icon name="plus" size={17}/>Publicar projeto</Link>
    </div> : null}
    {pagination && collection.data.hasMore && <div className="load-more-area"><button type="button" className="button button-outline load-more" disabled={!!collection.pending} onClick={() => collection.error ? collection.retry() : changePage(collection.data.loadedPages + 1)}>{collection.pending ? "Carregando..." : "Mostrar mais projetos"}<Icon name="arrow-down" size={18}/></button><p className="load-count">Mostrando {items.length} de {total}</p></div>}
    <dialog ref={dialogRef} className="dialog" aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => { if (pending) event.preventDefault(); else setTarget(null); }} onClick={event => { if (event.target === event.currentTarget && !pending) setTarget(null); }}>
      <span className="dialog-icon"><Icon name={removingPublication ? "trash" : "logout"} size={24}/></span>
      <h2 id="delete-title">{removingPublication ? "Excluir este projeto?" : "Sair deste projeto?"}</h2>
      <p id="delete-description">{removingPublication ? <>O projeto <strong>{target?.title}</strong> {removalDescription || "será removido da galeria e dos perfis de todos os autores, junto com suas curtidas. Essa ação não pode ser desfeita."}</> : <>Você deixará de aparecer como coautor de <strong>{target?.title}</strong>. O projeto e suas curtidas continuarão disponíveis para os outros participantes.</>}</p>
      <div className="dialog-actions">
        <button className="button button-outline" onClick={() => setTarget(null)} disabled={pending} autoFocus>{removingPublication ? "Manter meu projeto" : "Cancelar"}</button>
        <button className="button button-danger" onClick={remove} disabled={pending}>{pending ? <><Icon name="loader" size={15} className="spinner"/>{removingPublication ? "Excluindo..." : "Saindo..."}</> : removingPublication ? "Sim, excluir" : "Sair do projeto"}</button>
      </div>
    </dialog>
  </main>;
}
