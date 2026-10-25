import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPeople, getProjects } from "@/lib/queries";
import { getCurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { Icon } from "@/components/icon";
import { ProjectCard } from "@/components/project-card";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const person = (await getPeople()).find(p => p.id === id);
  return { title: person?.name || "Perfil não encontrado", description: person?.bio };
}
export default async function ProfilePage({ params }: Props) {
  const { id } = await params;
  const [people, allProjects, user] = await Promise.all([getPeople(), getProjects(), getCurrentUser()]);
  const person = people.find(p => p.id === id);
  if (!person) notFound();
  const projects = allProjects.filter(p => p.authors.some(author => author.id === person.id));
  const totalLikes = projects.reduce((total, p) => total + p.likes, 0);
  return <main id="conteudo" className="container inner-page"><Link href="/comunidade" className="back-link"><Icon name="arrow-left" size={16}/>Comunidade</Link><div className="profile-banner" aria-hidden="true"><span>✳</span><i/></div><section className="profile-summary"><Avatar person={person} size={108}/><div className="profile-info"><h1>{person.name}</h1><div className="profile-cohort"><Icon name="users" size={14}/>{person.cohort} · Formação em {person.year}<span>·</span>Comunidade Toti</div><p>{person.bio}</p><div className="profile-stats"><span><strong>{projects.length}</strong> {projects.length === 1 ? "projeto" : "projetos"}</span><span><strong>{totalLikes}</strong> curtidas recebidas</span></div></div>{user?.id === person.id ? <Link href="/meus-projetos" className="button button-outline">Meus projetos<Icon name="arrow-up-right" size={15}/></Link> : person.github ? <a className="button button-outline" href={person.github} target="_blank" rel="noopener noreferrer"><Icon name="github" size={16}/>GitHub<Icon name="arrow-up-right" size={14}/></a> : null}</section><section className="profile-projects"><div className="section-title"><h2>Projetos <span className="people-count">({projects.length})</span></h2></div>{projects.length ? <div className="project-grid">{projects.map(project => <ProjectCard project={project} key={project.id}/>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="code" size={30}/></span><h2>Uma nova história está começando.</h2><p>{user?.id === person.id ? "Publique seu primeiro projeto e mostre o que está aprendendo." : "Os primeiros projetos desse talento estarão aqui em breve."}</p><Link href={user?.id === person.id ? "/meus-projetos/novo" : "/"} className="button button-dark">{user?.id === person.id ? "Publicar meu primeiro projeto" : "Explorar a galeria"}<Icon name="arrow-right" size={16}/></Link></div>}</section></main>;
}
