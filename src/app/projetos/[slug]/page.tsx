import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProjects } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { ProjectCover } from "@/components/project-cover";
import { ProjectCard } from "@/components/project-card";
import { Icon } from "@/components/icon";
import { Avatar, CopyLinkButton, LikeButton } from "@/components/ui";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = (await getProjects()).find(p => p.slug === slug);
  return { title: project?.title || "Projeto não encontrado", description: project?.summary };
}
export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;
  const [projects, user] = await Promise.all([getProjects(), getCurrentUser()]);
  const project = projects.find(p => p.slug === slug);
  if (!project) notFound();
  const related = projects.filter(p => p.id !== project.id).sort((a, b) => Number(b.author.id === project.author.id) - Number(a.author.id === project.author.id)).slice(0, 3);
  return <main id="conteudo" className="container inner-page"><Link href="/" className="back-link"><Icon name="arrow-left" size={16}/>Voltar para a galeria</Link><div className="project-detail-heading"><div><h1>{project.title}</h1><div className="detail-author"><Link href={`/pessoas/${project.author.id}`}><Avatar person={project.author} size={32}/></Link><span>Um projeto de <Link href={`/pessoas/${project.author.id}`}><strong>{project.author.name}</strong></Link><span>·</span>{project.author.cohort} · {project.author.year}</span></div></div><div className="detail-actions"><LikeButton id={project.id} initialLiked={project.liked} initialLikes={project.likes} full/><CopyLinkButton/></div></div><div className="detail-layout"><div className="detail-main"><ProjectCover title={project.title} style={project.coverStyle} imageUrl={project.imageUrl} category={project.category}/><section className="detail-description"><h2>Uma ideia, muitas descobertas.</h2>{project.description.split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section></div><aside className="project-sidebar"><h2>{project.summary}</h2><div className="sidebar-links">{project.liveUrl && <a className="button button-dark" href={project.liveUrl} target="_blank" rel="noopener noreferrer">Ver projeto ao vivo<Icon name="arrow-up-right" size={17}/></a>}{project.githubUrl && <a className="button button-outline" href={project.githubUrl} target="_blank" rel="noopener noreferrer"><Icon name="github" size={17}/>Explorar o código<Icon name="arrow-up-right" size={15}/></a>}{!project.liveUrl && !project.githubUrl && <p className="sidebar-bio">Os links deste projeto estarão disponíveis em breve. Enquanto isso, conheça a história por trás da ideia.</p>}{user?.id === project.author.id && <Link className="button button-light" href={`/meus-projetos/${project.id}/editar`}><Icon name="edit" size={16}/>Editar meu projeto</Link>}</div><div className="sidebar-block"><h3>Construído com</h3><div className="technology-tags">{project.technologies.map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}</div></div><div className="sidebar-block"><h3>Quem está por trás</h3><Link className="sidebar-author" href={`/pessoas/${project.author.id}`}><Avatar person={project.author} size={42}/><span>{project.author.name}<small>{project.author.cohort} · {project.author.year}</small></span></Link><p className="sidebar-bio">{project.author.bio}</p><Link className="sidebar-profile" href={`/pessoas/${project.author.id}`}>Conhecer esse talento<Icon name="arrow-up-right" size={14}/></Link></div><p className="project-date"><Icon name="clock" size={13}/>Publicado em {new Date(project.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })}</p></aside></div>{related.length > 0 && <section className="related-projects"><div className="section-title"><h2>Outras ideias para explorar</h2><Link href="/">Voltar para a galeria<Icon name="arrow-right" size={16}/></Link></div><div className="project-grid">{related.map(p => <ProjectCard project={p} key={p.id}/>)}</div></section>}</main>;
}
