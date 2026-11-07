"use client";

import Link from "next/link";
import type { ProjectSummary } from "@/lib/types";
import type { CollectionSnapshot } from "@/lib/collection-page";
import { ProjectCard } from "./project-card";
import { Icon } from "./icon";
import { usePagedCollection } from "./use-paged-collection";
import { useGalleryFilters } from "./use-gallery-filters";
import { CollectionFeedback } from "./collection-feedback";

export function ProfileProjects({ initialPage, slug, isOwner }: { initialPage: CollectionSnapshot<ProjectSummary>; slug: string; isOwner: boolean }) {
  const collection = usePagedCollection(initialPage, `/api/projects?view=profile&slug=${encodeURIComponent(slug)}`);
  const { changePage } = useGalleryFilters("page");
  const { items, total, loadedPages: page } = collection.data;
  return <section className="profile-projects">
    <div className="section-title"><h2>Projetos <span className="people-count">({total})</span></h2></div>
    <CollectionFeedback error={collection.error} retry={collection.retry} pending={collection.pending} hasItems={items.length > 0}/>
    {items.length ? <div className="project-grid" aria-busy={collection.pending}>{items.map(project => <ProjectCard project={project} key={project.id}/>)}</div>
      : !collection.pending && !collection.error ? <div className="empty-state"><span className="empty-icon"><Icon name="code" size={30}/></span><h2>Uma nova história está começando.</h2><p>{isOwner ? "Publique seu primeiro projeto e mostre o que está aprendendo." : "Os primeiros projetos desse talento estarão aqui em breve."}</p><Link href={isOwner ? "/meus-projetos/novo" : "/"} className="button button-dark">{isOwner ? "Publicar meu primeiro projeto" : "Explorar a galeria"}<Icon name="arrow-right" size={16}/></Link></div> : null}
    {collection.data.hasMore && <div className="load-more-area"><button type="button" className="button button-outline load-more" disabled={!!collection.pending} onClick={() => collection.error ? collection.retry() : changePage(page + 1)}>{collection.pending ? "Carregando..." : "Carregar mais projetos"}<Icon name="arrow-down" size={18}/></button><p className="load-count">Mostrando {items.length} de {total}</p></div>}
  </section>;
}
