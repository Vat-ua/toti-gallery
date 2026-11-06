"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { demoPerson, demoLinks, demoTurmas, type DemoWorkspace } from "@/lib/demo-data";
import { loadDemo, saveDemoProject, deleteDemoProject, setDemoLike } from "@/lib/demo-store";
import type { LikeAction } from "@/lib/likes-client";
import type { Project } from "@/lib/types";
import { Icon } from "./icon";
import { MyProjects, type MyProjectsActions } from "./my-projects";
import { ProjectEditor, type ProjectEditorActions } from "./project-editor";
import { ProjectDetails } from "./project-details";
import { ProjectCard } from "./project-card";
import { ProfileSummary } from "./profile-summary";
import { BrandSymbol } from "./brand-symbol";
import { useDemoMode } from "./demo-mode";

type Loaded = { data: DemoWorkspace; projects: Project[]; urls: string[] };
type DemoContextValue = { projects: Project[]; editor: ProjectEditorActions; management: MyProjectsActions; like: LikeAction };
const DemoContext = createContext<DemoContextValue | null>(null);
function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error("Demo screens require their local workspace.");
  return value;
}
function materialize(data: DemoWorkspace): Loaded {
  const urls: string[] = [];
  const projects = data.projects.map(({ image, ...project }) => {
    const imageUrl = image ? URL.createObjectURL(image) : null;
    if (imageUrl) urls.push(imageUrl);
    return { ...project, imageUrl, author: demoPerson, authors: [demoPerson] };
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { data, projects, urls };
}

export function DemoWorkspaceProvider({ children }: { children: ReactNode }) {
  const { revision } = useDemoMode();
  return <LocalWorkspace key={revision}>{children}</LocalWorkspace>;
}
function LocalWorkspace({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    loadDemo().then(data => { if (!cancelled) { setLoaded(materialize(data)); setError(""); } })
      .catch(error => { if (!cancelled) setError(error instanceof Error ? error.message : "Não foi possível abrir a demonstração."); });
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => () => { loaded?.urls.forEach(url => URL.revokeObjectURL(url)); }, [loaded]);
  const generation = loaded?.data.generation;
  const like = useCallback<LikeAction>(async (id, liked) => {
    if (!generation) throw new Error("A demonstração ainda está carregando.");
    const data = await setDemoLike(generation, id, liked);
    setLoaded(materialize(data));
    const project = data.projects.find(project => project.id === id)!;
    return { liked: project.liked, likes: project.likes };
  }, [generation]);
  const context: DemoContextValue | null = loaded ? {
    projects: loaded.projects,
    like,
    editor: {
      async create(values, requestId, file) {
        setLoaded(materialize(await saveDemoProject(loaded.data.generation, requestId, values, undefined, file)));
        return { id: requestId, slug: requestId };
      },
      async update(id, values, version, file) {
        setLoaded(materialize(await saveDemoProject(loaded.data.generation, id, values, version, file)));
        return { ok: true, slug: id };
      },
    },
    management: {
      like,
      async remove(id) { setLoaded(materialize(await deleteDemoProject(loaded.data.generation, id))); return { ok: true, slug: id }; },
      async leave() { throw new Error("Os projetos desta demonstração pertencem ao seu perfil fictício."); },
    },
  } : null;
  return <>
    {error ? <main id="conteudo" className="container inner-page"><div className="empty-state" role="alert"><h1>Demonstração indisponível</h1><p>{error}</p><button type="button" className="button button-dark" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div></main>
      : context ? <DemoContext.Provider value={context}><div className="demo-content" key={loaded!.data.generation}>{children}</div></DemoContext.Provider>
      : <main id="conteudo" className="container inner-page" aria-busy="true"><p className="demo-loading" role="status"><Icon name="loader" className="spinner" size={20}/>Preparando demonstração…</p></main>}

  </>;
}

export function DemoProjects() {
  const { projects, management } = useDemo();
  return <MyProjects projects={projects} user={demoPerson} actions={management} links={demoLinks} backHref={null} removalDescription="será removido apenas desta demonstração. Essa ação não pode ser desfeita." removalSuccessMessage="Projeto excluído da demonstração."/>;
}
export function DemoEditor({ id }: { id?: string }) {
  const { projects, editor } = useDemo();
  const project = id ? projects.find(project => project.id === id) : undefined;
  if (id && !project) return <DemoMissingProject/>;
  return <ProjectEditor key={id ?? "new"} user={demoPerson} project={project} people={[]} turmas={demoTurmas} actions={editor} links={demoLinks} showCoauthors={false} successMessage="Projeto salvo na demonstração."/>;
}
export function DemoProjectDetails({ id }: { id: string }) {
  const { projects, like } = useDemo();
  const project = projects.find(project => project.id === id);
  return project ? <ProjectDetails project={project} canEdit likeAction={like} links={demoLinks} backHref="/demo" backLabel="Meus projetos"/> : <DemoMissingProject/>;
}
function DemoMissingProject() {
  return <main id="conteudo" className="container inner-page"><div className="empty-state"><h1>Projeto não encontrado</h1><p>Ele pode ter sido excluído ou removido ao restaurar a demonstração.</p><Link href="/demo" className="button button-dark">Meus projetos</Link></div></main>;
}
export function DemoProfile() {
  const { projects, like } = useDemo();
  return <main id="conteudo" className="container inner-page">
    <Link href="/demo" className="back-link"><Icon name="arrow-left" size={16}/>Meus projetos</Link>
    <div className="profile-banner" aria-hidden="true"><span><BrandSymbol/></span><i/></div>
    <ProfileSummary person={demoPerson} isOwner={false} projectCount={projects.length} totalLikes={projects.reduce((sum, project) => sum + project.likes, 0)}/>
    <section className="profile-projects"><div className="section-title"><h2>Projetos <span className="people-count">({projects.length})</span></h2></div>
      {projects.length ? <div className="project-grid">{projects.map(project => <ProjectCard key={project.id} project={project} href={demoLinks.view(project)} links={demoLinks} likeAction={like}/>)}</div>
        : <div className="empty-state"><h2>Você ainda não tem projetos.</h2><Link href="/demo/novo" className="button button-dark">Publicar projeto</Link></div>}
    </section>
  </main>;
}
