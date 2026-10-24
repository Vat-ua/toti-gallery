"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Person, Project } from "@/lib/types";
import { ProjectCard } from "./project-card";
import { Icon } from "./icon";
import { useToast } from "./ui";

export function MyProjects({ projects, user }: { projects: Project[]; user: Person }) {
  const [items, setItems] = useState(projects);
  const [target, setTarget] = useState<Project | null>(null);
  const [pending, setPending] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const notify = useToast();
  const router = useRouter();
  useEffect(() => setItems(projects), [projects]);
  useEffect(() => { if (target) dialogRef.current?.showModal(); else dialogRef.current?.close(); }, [target]);
  async function remove() {
    if (!target) return;
    setPending(true);
    try {
      const response = await fetch(`/api/projects/${target.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setItems(items.filter(item => item.id !== target.id)); setTarget(null);
      notify("Projeto excluído. Novas ideias vêm por aí."); router.refresh();
    } catch (err) { notify(err instanceof Error ? err.message : "Não foi possível excluir o projeto.", true); }
    finally { setPending(false); }
  }
  return <main id="conteudo" className="container inner-page"><Link href="/" className="back-link"><Icon name="arrow-left" size={16}/>Voltar para a galeria</Link><div className="page-heading"><div><span className="eyebrow"><span className="eyebrow-dot"/> SEU CÓDIGO, SUA HISTÓRIA</span><h1>Meus projetos<span style={{ color: "#a48abc" }}>.</span></h1><p>Olá, {user.name.split(" ")[0]}. Cada projeto é um novo passo na sua jornada.</p></div><Link href="/meus-projetos/novo" className="button button-dark">Compartilhar projeto<Icon name="plus" size={17}/></Link></div><div className="dashboard-summary">{items.length} {items.length === 1 ? "ideia compartilhada" : "ideias compartilhadas"} <span style={{ margin: "0 8px", color: "#c8b8d3" }}>·</span> <Link href={`/pessoas/${user.id}`}>Ver meu perfil público ↗</Link></div>{items.length ? <div className="management-grid">{items.map(project => <div key={project.id}><ProjectCard project={project}/><div className="management-actions"><Link href={`/meus-projetos/${project.id}/editar`}><Icon name="edit" size={15}/>Editar projeto</Link><Link href={`/projetos/${project.slug}`}><Icon name="eye" size={15}/>Visualizar</Link><button aria-label={`Excluir ${project.title}`} onClick={() => setTarget(project)}><Icon name="trash" size={16}/></button></div></div>)}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="code" size={32}/></span><h2>O primeiro passo pode ser agora.</h2><p>Um exercício, uma descoberta ou seu projeto final.<br/>Toda ideia merece um lugar para crescer.</p><Link href="/meus-projetos/novo" className="button button-dark">Compartilhar meu primeiro projeto<Icon name="plus" size={17}/></Link></div>}<dialog ref={dialogRef} className="dialog" aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={event => { if (pending) event.preventDefault(); else setTarget(null); }} onClick={event => { if (event.target === event.currentTarget && !pending) setTarget(null); }}><span className="dialog-icon"><Icon name="trash" size={24}/></span><h2 id="delete-title">Excluir este projeto?</h2><p id="delete-description">O projeto <strong>{target?.title}</strong> será removido da galeria e do seu perfil, junto com suas curtidas. Essa ação não pode ser desfeita.</p><div className="dialog-actions"><button className="button button-outline" onClick={() => setTarget(null)} disabled={pending} autoFocus>Manter meu projeto</button><button className="button button-danger" onClick={remove} disabled={pending}>{pending ? <><Icon name="loader" size={15} className="spinner"/>Excluindo...</> : "Sim, excluir"}</button></div></dialog></main>;
}
