import Link from "next/link";
import type { Project } from "@/lib/types";
import { Avatar, LikeButton } from "./ui";
import { Icon } from "./icon";
import { ProjectCover } from "./project-cover";

export function ProjectLikeCount({ likes }: { likes: number }) {
  return <span className="project-like-count" aria-label={`${likes} curtidas`}><Icon name="heart" size={16}/><span>{likes}</span></span>;
}

export function ProjectCard({ project, isCoauthor = false, href = `/projetos/${project.slug}`, readOnly = false }: { project: Project; isCoauthor?: boolean; href?: string; readOnly?: boolean }) {
  const visibleTechs = 3;
  return <article className="project-card">
    <Link href={href} className="project-cover-link" aria-label={`Ver projeto: ${project.title}${project.isFinal ? ", projeto final" : ""}`}>
      <ProjectCover title={project.title} style={project.coverStyle} imageUrl={project.imageUrl} isFinal={project.isFinal}/>
    </Link>
    <div className="project-card-body">
      <div className="card-meta">
        <div className="card-author-details">
          {project.authors.length > 1 ? <Link href={`${href}#autores`} className="project-author" aria-label={`Ver os ${project.authors.length} autores de ${project.title}${isCoauthor ? ". Você é coautor." : ""}`}>
            <span className="avatar-stack">{project.authors.slice(0, 3).map(author => <Avatar key={author.id} person={author} size={26}/>)}</span>
            <span className="author-name">{project.authors.length} autores{isCoauthor && <span className="coauthor-label"> (coautor)</span>}</span>
          </Link> : <Link href={`/pessoas/${project.author.id}`} className="project-author"><Avatar person={project.author} size={26}/><span className="author-name">{project.author.name}</span></Link>}
        </div>
        {readOnly ? <ProjectLikeCount likes={project.likes}/> : <LikeButton id={project.id} initialLiked={project.liked} initialLikes={project.likes}/>}
      </div>
      <div className="technology-tags">{project.technologies.slice(0, visibleTechs).map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}{project.technologies.length > visibleTechs && <span className="technology-tag technology-more">+{project.technologies.length - visibleTechs}</span>}</div>
    </div>
  </article>;
}
