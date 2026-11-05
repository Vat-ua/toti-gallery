import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPersonBySlug, getProjects } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { ProfileSummary } from "@/components/profile-summary";
import { Icon } from "@/components/icon";
import { BrandSymbol } from "@/components/brand-symbol";
import { ProjectCard } from "@/components/project-card";

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const person = await getPersonBySlug(slug);
  return { title: person?.name || "Perfil não encontrado", description: person?.bio };
}
export default async function ProfilePage({ params }: Props) {
  const { slug } = await params;
  const [person, allProjects, user] = await Promise.all([getPersonBySlug(slug), getProjects(), getCurrentUser()]);
  if (!person) notFound();
  const projects = allProjects.filter(p => p.authors.some(author => author.id === person.id));
  const totalLikes = projects.reduce((total, p) => total + p.likes, 0);
  return <main id="conteudo" className="container inner-page"><Link href="/comunidade" className="back-link"><Icon name="arrow-left" size={16}/>Comunidade</Link><div className="profile-banner" aria-hidden="true"><span><BrandSymbol/></span><i/></div><ProfileSummary person={person} isOwner={user?.id === person.id} projectCount={projects.length} totalLikes={totalLikes}/><section className="profile-projects"><div className="section-title"><h2>Projetos <span className="people-count">({projects.length})</span></h2></div>{projects.length ? <div className="project-grid">{projects.map(project => <ProjectCard project={project} key={project.id}/>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="code" size={30}/></span><h2>Uma nova história está começando.</h2><p>{user?.id === person.id ? "Publique seu primeiro projeto e mostre o que está aprendendo." : "Os primeiros projetos desse talento estarão aqui em breve."}</p><Link href={user?.id === person.id ? "/meus-projetos/novo" : "/"} className="button button-dark">{user?.id === person.id ? "Publicar meu primeiro projeto" : "Explorar a galeria"}<Icon name="arrow-right" size={16}/></Link></div>}</section></main>;
}
