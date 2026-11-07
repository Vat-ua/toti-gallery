import Link from "next/link";
import type { ReactNode } from "react";
import type { Project, ProjectSummary } from "@/lib/types";
import type { LikeAction } from "@/lib/likes-client";
import { ProjectCover } from "./project-cover";
import { ProjectCard, ProjectLikeCount } from "./project-card";
import { Icon } from "./icon";
import { Avatar, LikeButton } from "./ui";
import { ProjectDescription } from "./project-description";

import { studentProjectLinks, type ProjectLinks } from "@/lib/project-links";

export function RelatedProjects({ projects, backHref = "/", links = studentProjectLinks, likeAction, readOnly = false }: {
  projects: ProjectSummary[]; backHref?: string; links?: ProjectLinks; likeAction?: LikeAction; readOnly?: boolean;
}) {
  if (!projects.length) return null;
  return <section className="related-projects">
    <div className="section-title"><h2>Outros projetos</h2><Link href={backHref}>Projetos<Icon name="arrow-right" size={16}/></Link></div>
    <div className="project-grid">{projects.map(p => <ProjectCard project={p} key={p.id} href={links.view(p)} links={links} likeAction={likeAction} readOnly={readOnly}/>)}</div>
  </section>;
}

export function ProjectDetails({ project, related = [], canEdit = false, relatedContent, readOnly = false, embedded = false, backHref = "/", backLabel = "Projetos", notice, likeAction, links = studentProjectLinks }: {
  project: Project; related?: ProjectSummary[]; canEdit?: boolean; readOnly?: boolean; embedded?: boolean;
  backHref?: string; backLabel?: string; notice?: ReactNode; likeAction?: LikeAction; links?: ProjectLinks;
  relatedContent?: ReactNode;
}) {
  const Wrapper = embedded ? "section" : "main";
  return <Wrapper {...(embedded ? {} : { id: "conteudo" })} className={embedded ? "admin-project-preview" : "container inner-page"}>
    <Link href={backHref} className="back-link"><Icon name="arrow-left" size={16}/>{backLabel}</Link>
    {notice}
    <div className="project-detail-heading">
      <div>
        <h1>{project.title}</h1>
        <div className="detail-author">
          {project.authors.length > 1 ? <a href="#autores" className="detail-author-link">
            <span className="avatar-stack">{project.authors.slice(0, 3).map(author => <Avatar key={author.id} person={author} size={32}/>)}</span>
            <span>{project.authors.length} autores</span>
          </a> : <Link href={links.profile(project.author.slug)} className="detail-author-link">
            <Avatar person={project.author} size={32}/><strong>{project.author.name}</strong>
          </Link>}
          {project.isFinal && <span className="project-final-badge">Projeto final</span>}
        </div>
      </div>
      <div className="detail-actions">
        {canEdit && <Link className="button button-dark" href={links.edit(project.id)}><Icon name="edit" size={16}/>Editar projeto</Link>}
        {readOnly ? <ProjectLikeCount likes={project.likes}/> : <LikeButton id={project.id} initialLiked={project.liked} initialLikes={project.likes} observedAt={project.likesObservedAt} full action={likeAction}/>}
      </div>
    </div>
    <div className="detail-layout">
      <div className="detail-main">
        <ProjectCover title={project.title} style={project.coverStyle} imageUrl={project.imageUrl} framing={project.coverFraming} fullSize/>
      </div>
      <aside className="project-sidebar" aria-labelledby="project-details-title">
        <div className="project-sidebar-heading">
          <h2 id="project-details-title">Detalhes</h2>
          <p className="sidebar-cohort">{project.author.cohort}</p>
        </div>
        <div className="sidebar-links">
          {project.liveUrl && <a className="button button-dark" href={project.liveUrl} target="_blank" rel="noopener noreferrer">Acessar projeto<Icon name="arrow-up-right" size={17}/></a>}
          <a className="button button-outline" href={project.githubUrl} target="_blank" rel="noopener noreferrer"><Icon name="github" size={17}/>Ver código<Icon name="arrow-up-right" size={15}/></a>
        </div>
        <div className="sidebar-block" id="autores">
          <h3>{project.authors.length > 1 ? "Autores" : "Autor"}</h3>
          <div className="sidebar-authors">
            {project.authors.map(author => <Link key={author.id} className="sidebar-author" href={links.profile(author.slug)}><Avatar person={author} size={42}/><span>{author.name}</span></Link>)}
          </div>
        </div>
        <div className="sidebar-block">
          <h3>Tecnologias</h3>
          <div className="technology-tags">{project.technologies.map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}</div>
        </div>
        <p className="project-date"><Icon name="clock" size={13}/>Publicado em {new Date(project.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</p>
      </aside>
      <section className="detail-description">
        <h2>Sobre o projeto</h2>
        <ProjectDescription>{project.description}</ProjectDescription>
      </section>
    </div>
    {relatedContent ?? <RelatedProjects projects={related} backHref={backHref} links={links} likeAction={likeAction} readOnly={readOnly}/>}
  </Wrapper>;
}
