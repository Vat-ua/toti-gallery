import Link from "next/link";
import type { Project } from "@/lib/types";
import { Avatar, LikeButton } from "./ui";
import { ProjectCover } from "./project-cover";

export function ProjectCard({ project }: { project: Project }) {
  return <article className="project-card"><Link href={`/projetos/${project.slug}`} className="project-cover-link" aria-label={`Conhecer o projeto ${project.title}`}><ProjectCover title={project.title} style={project.coverStyle} imageUrl={project.imageUrl} category={project.category}/></Link><div className="project-card-title"><h3><Link href={`/projetos/${project.slug}`}>{project.title}</Link></h3><LikeButton id={project.id} initialLiked={project.liked} initialLikes={project.likes}/></div><Link href={`/pessoas/${project.author.id}`} className="project-author"><Avatar person={project.author} size={23}/><span className="author-name">{project.author.name}</span><span className="author-separator">·</span><span className="author-cohort">{project.author.cohort} <span>· {project.author.year}</span></span></Link><div className="technology-tags">{project.technologies.slice(0, 3).map(tech => <span className={`technology-tag tech-${tech.toLowerCase().replace(/[^a-z]/g, "")}`} key={tech}>{tech}</span>)}{project.technologies.length > 3 && <span className="technology-tag">+{project.technologies.length - 3}</span>}</div></article>;
}
