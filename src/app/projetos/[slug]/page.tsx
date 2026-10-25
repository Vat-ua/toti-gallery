import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProjects } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { ProjectCover } from "@/components/project-cover";
import { ProjectCard } from "@/components/project-card";
import { Icon } from "@/components/icon";
import { Avatar, LikeButton } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = (await getProjects()).find(p => p.slug === slug);
  return { title: project?.title || "Projeto não encontrado", description: project?.description.replace(/\s+/g, " ").trim().slice(0, 160) };
}
export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [projects, user] = await Promise.all([getProjects(), getCurrentUser()]);
  const project = projects.find(p => p.slug === slug);
  if (!project) notFound();
  const related = projects.filter(p => p.id !== project.id).sort((a, b) => Number(b.authors.some(author => project.authors.some(person => person.id === author.id))) - Number(a.authors.some(author => project.authors.some(person => person.id === author.id)))).slice(0, 3);
  return <main id="conteudo" className="container inner-page">
    <Link href="/" className="back-link"><Icon name="arrow-left" size={16}/>Projetos</Link>
    <div className="project-detail-heading">
      <div>
        <h1>{project.title}</h1>
        <div className="detail-author">
          {project.authors.length > 1 ? <a href="#autores" className="detail-author-link">
            <span className="avatar-stack">{project.authors.slice(0, 3).map(author => <Avatar key={author.id} person={author} size={32}/>)}</span>
            <span>{project.authors.length} autores</span>
          </a> : <Link href={`/pessoas/${project.author.id}`} className="detail-author-link">
            <Avatar person={project.author} size={32}/><strong>{project.author.name}</strong>
          </Link>}
          {project.isFinal && <span className="project-final-badge">Projeto final</span>}
        </div>
      </div>
      <div className="detail-actions">
        {user?.id === project.author.id && <Link className="button button-dark" href={`/meus-projetos/${project.id}/editar`}><Icon name="edit" size={16}/>Editar projeto</Link>}
        <LikeButton id={project.id} initialLiked={project.liked} initialLikes={project.likes} full/>
      </div>
    </div>
    <div className="detail-layout">
      <div className="detail-main">
        <ProjectCover title={project.title} style={project.coverStyle} imageUrl={project.imageUrl}/>
        <section className="detail-description">
          <h2>Sobre o projeto</h2>
          {project.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </section>
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
            {project.authors.map(author => <Link key={author.id} className="sidebar-author" href={`/pessoas/${author.id}`}><Avatar person={author} size={42}/><span>{author.name}</span></Link>)}
          </div>
        </div>
        <div className="sidebar-block">
          <h3>Tecnologias</h3>
          <div className="technology-tags">{project.technologies.map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}</div>
        </div>
        <p className="project-date"><Icon name="clock" size={13}/>Publicado em {new Date(project.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</p>
      </aside>
    </div>
    {related.length > 0 && <section className="related-projects">
      <div className="section-title"><h2>Outros projetos</h2><Link href="/">Projetos<Icon name="arrow-right" size={16}/></Link></div>
      <div className="project-grid">{related.map(p => <ProjectCard project={p} key={p.id}/>)}</div>
    </section>}
  </main>;
}
