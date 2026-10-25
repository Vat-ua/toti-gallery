import Link from "next/link";
import type { Project } from "@/lib/types";
import { Avatar, LikeButton } from "./ui";
import { ProjectCover } from "./project-cover";

export function ProjectCard({ project }: { project: Project }) {
  const visibleTechs = 3;
  return <article className="project-card">
    <Link href={`/projetos/${project.slug}`} className="project-cover-link" aria-label={`Ver projeto: ${project.title}`}>
      <ProjectCover title={project.title} style={project.coverStyle} imageUrl={project.imageUrl} category={project.category}/>
    </Link>
    <div className="project-card-body">
      <div className="card-meta">
        <div className="card-author-details">
          <Link href={`/pessoas/${project.author.id}`} className="project-author"><Avatar person={project.author} size={26}/><span className="author-name">{project.author.name}</span></Link>
          <span className="card-meta-dot" aria-hidden="true"/>
          <span className="author-cohort">{project.author.cohort}</span>
        </div>
        <LikeButton id={project.id} initialLiked={project.liked} initialLikes={project.likes}/>
      </div>
      <div className="technology-tags">{project.technologies.slice(0, visibleTechs).map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}{project.technologies.length > visibleTechs && <span className="technology-tag technology-more">+{project.technologies.length - visibleTechs}</span>}</div>
    </div>
  </article>;
}
