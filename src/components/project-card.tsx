import Link from "next/link";
import type { Project } from "@/lib/types";
import { Avatar, LikeButton } from "./ui";
import { ProjectCover } from "./project-cover";

export function ProjectCard({ project }: { project: Project }) {
  const visibleTechs = 3;
  const cohorts = [...new Set(project.authors.map(author => author.cohort))];
  return <article className="project-card">
    <Link href={`/projetos/${project.slug}`} className="project-cover-link" aria-label={`Ver projeto: ${project.title}`}>
      <ProjectCover title={project.title} style={project.coverStyle} imageUrl={project.imageUrl}/>
    </Link>
    <div className="project-card-body">
      <div className="card-meta">
        <div className="card-author-details">
          {project.authors.length > 1 ? <Link href={`/projetos/${project.slug}#autores`} className="project-author" aria-label={`Ver os ${project.authors.length} autores de ${project.title}`}>
            <span className="avatar-stack">{project.authors.slice(0, 3).map(author => <Avatar key={author.id} person={author} size={26}/>)}</span>
            <span className="author-name">{project.authors.length} autores</span>
          </Link> : <Link href={`/pessoas/${project.author.id}`} className="project-author"><Avatar person={project.author} size={26}/><span className="author-name">{project.author.name}</span></Link>}
          <span className="card-meta-dot" aria-hidden="true"/>
          <span className="author-cohort">{cohorts.length === 1 ? cohorts[0] : `${cohorts.length} turmas`}</span>
        </div>
        <LikeButton id={project.id} initialLiked={project.liked} initialLikes={project.likes}/>
      </div>
      <div className="technology-tags">{project.technologies.slice(0, visibleTechs).map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}{project.technologies.length > visibleTechs && <span className="technology-tag technology-more">+{project.technologies.length - visibleTechs}</span>}</div>
    </div>
  </article>;
}
