"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Person, Project } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar } from "./ui";
import { ProjectCard } from "./project-card";
import { ProjectCover } from "./project-cover";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function Gallery({ projects, people }: { projects: Project[]; people: Person[] }) {
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [cohort, setCohort] = useState("");
  const [techs, setTechs] = useState<string[]>([]);
  const [sort, setSort] = useState("recent");
  const [featured, setFeatured] = useState(false);
  const [visible, setVisible] = useState(7);
  const searchRef = useRef<HTMLInputElement>(null);
  const hasFilters = !!(query || cohort || techs.length || featured);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const element = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) && !element.isContentEditable) {
        event.preventDefault(); searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  const cohorts = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(project => { const key = `${project.author.cohort} · ${project.author.year}`; map.set(key, (map.get(key) || 0) + 1); });
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0], "pt-BR"));
  }, [projects]);
  const techOptions = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach(project => project.technologies.forEach(tech => map.set(tech, (map.get(tech) || 0) + 1)));
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
  }, [projects]);

  const filtered = useMemo(() => projects.filter(project => {
    const text = normalize(`${project.title} ${project.summary} ${project.author.name} ${project.technologies.join(" ")}`);
    return (!search || text.includes(normalize(search)))
      && (!cohort || `${project.author.cohort} · ${project.author.year}` === cohort)
      && (!featured || project.featured)
      && techs.every(tech => project.technologies.includes(tech));
  }).sort((a, b) => sort === "likes" ? b.likes - a.likes : sort === "az" ? a.title.localeCompare(b.title, "pt-BR") : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [projects, search, cohort, featured, techs, sort]);

  const spotlight = useMemo(() => [...projects].sort((a, b) => b.likes - a.likes)[0], [projects]);
  const showLead = !hasFilters && filtered.length >= 3;
  const featuredCount = projects.filter(project => project.featured).length;

  function clear() { setQuery(""); setCohort(""); setTechs([]); setFeatured(false); setVisible(7); }
  function toggleTech(tech: string) { setTechs(current => current.includes(tech) ? current.filter(item => item !== tech) : [...current, tech]); setVisible(7); }

  return <main id="conteudo">
    <section className="hero container" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="eyebrow"><span className="eyebrow-dot"/>Galeria da comunidade Toti</span>
        <h1 id="hero-title">O que a Toti está <em>construindo</em>.</h1>
        <p className="hero-lead">Projetos de estudantes e pessoas formadas nas nossas turmas: exercícios de HTML e CSS, experimentos em JavaScript e aplicações full-stack.</p>
        <div className="hero-actions">
          <a href="#projetos" className="button button-accent">Explorar projetos<Icon name="arrow-right" size={18}/></a>
          <Link href="/comunidade" className="hero-people"><span className="avatar-stack">{people.slice(0, 4).map(person => <Avatar person={person} key={person.id} size={32}/>)}</span><span>{people.length} pessoas publicando</span></Link>
        </div>
        <dl className="hero-stats">
          <div><dt>Projetos</dt><dd>{projects.length}</dd></div>
          <div><dt>Pessoas</dt><dd>{people.length}</dd></div>
          <div><dt>Turmas</dt><dd>{cohorts.length}</dd></div>
        </dl>
      </div>
      {spotlight && <aside className="hero-side" aria-label="Projeto mais curtido da galeria">
        <Link href={`/projetos/${spotlight.slug}`} className="spotlight">
          <ProjectCover title={spotlight.title} style={spotlight.coverStyle} imageUrl={spotlight.imageUrl} hoverLabel="Ver projeto"/>
          <div className="spotlight-info">
            <span className="spotlight-label">Mais curtido</span>
            <strong className="spotlight-title">{spotlight.title}</strong>
            <span className="spotlight-author">{spotlight.author.name} · {spotlight.author.cohort}</span>
            <span className="spotlight-arrow" aria-hidden="true"><Icon name="arrow-up-right" size={20}/></span>
          </div>
        </Link>
        <span className="spotlight-sticker" aria-hidden="true"><strong>{spotlight.likes}</strong> curtidas</span>
      </aside>}
    </section>

    <div className="marquee" aria-hidden="true"><div className="marquee-track">{[0, 1].map(copy => <div className="marquee-set" key={copy}>{techOptions.map(([tech, count]) => <span className="marquee-item" key={tech}><span>{tech}</span><small>{count}</small><b>✳</b></span>)}<span className="marquee-item"><span>{featuredCount} em destaque</span><b>✳</b></span></div>)}</div></div>

    <section className="gallery-section container" id="projetos" aria-labelledby="gallery-title">
      <div className="gallery-head">
        <div><h2 id="gallery-title">Explorar projetos</h2><p>{projects.length} publicados por {people.length} pessoas de {cohorts.length} turmas.</p></div>
        <div className="view-tabs" role="group" aria-label="Filtrar por destaque">
          <button className={!featured ? "view-tab is-active" : "view-tab"} aria-pressed={!featured} onClick={() => { setFeatured(false); setVisible(7); }}>Todos<span>{projects.length}</span></button>
          <button className={featured ? "view-tab is-active" : "view-tab"} aria-pressed={featured} onClick={() => { setFeatured(true); setVisible(7); }}>Destaques<span>{featuredCount}</span></button>
        </div>
      </div>

      <div className="controls">
        <div className="controls-row">
          <div className="search-field"><Icon name="search" size={20}/><input ref={searchRef} aria-label="Buscar projetos" placeholder="Buscar por projeto, pessoa ou tecnologia" value={query} onChange={event => { setQuery(event.target.value); setVisible(7); }}/>{query ? <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><Icon name="x" size={16}/></button> : <kbd>/</kbd>}</div>
          <div className="sort-field"><label htmlFor="sort-projects">Ordenar</label><div className="select-wrap"><select id="sort-projects" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Recentes</option><option value="likes">Mais curtidos</option><option value="az">A–Z</option></select><Icon name="chevron-down" size={15}/></div></div>
        </div>
        <div className="chip-group"><span className="chip-group-label">Turma</span><div className="chips" role="group" aria-label="Filtrar por turma"><button className={!cohort ? "chip is-on" : "chip"} aria-pressed={!cohort} onClick={() => { setCohort(""); setVisible(7); }}>Todas</button>{cohorts.map(([value, count]) => <button key={value} className={cohort === value ? "chip is-on" : "chip"} aria-pressed={cohort === value} onClick={() => { setCohort(cohort === value ? "" : value); setVisible(7); }}>{value}<span>{count}</span></button>)}</div></div>
        <div className="chip-group"><span className="chip-group-label">Tecnologia</span><div className="chips" role="group" aria-label="Filtrar por tecnologia">{techOptions.map(([tech, count]) => <button key={tech} className={techs.includes(tech) ? "chip is-on" : "chip"} aria-pressed={techs.includes(tech)} onClick={() => toggleTech(tech)}>{tech}<span>{count}</span></button>)}</div></div>
      </div>

      <div className="results-bar">
        <p aria-live="polite"><strong>{filtered.length}</strong> {filtered.length === 1 ? "projeto" : "projetos"}{hasFilters && <span className="results-total"> de {projects.length}</span>}</p>
        {hasFilters && <button type="button" className="clear-filters" onClick={clear}>Limpar filtros<Icon name="x" size={14}/></button>}
      </div>

      {filtered.length > 0 ? <>
        <div className={`project-grid ${showLead ? "with-lead" : ""} ${search !== query ? "is-searching" : ""}`}>
          {filtered.slice(0, visible).map((project, index) => <ProjectCard key={project.id} project={project} lead={showLead && index === 0}/>)}
        </div>
        <div className="load-more-area">
          {visible < filtered.length ? <button className="button button-outline load-more" onClick={() => setVisible(value => value + 6)}>Carregar mais projetos<Icon name="arrow-down" size={18}/></button> : <><p className="end-of-gallery">Você chegou ao fim da galeria.</p><Link href="/meus-projetos/novo" className="end-link">Publicar um projeto<Icon name="arrow-up-right" size={16}/></Link></>}
          <p className="load-count">Mostrando {Math.min(visible, filtered.length)} de {filtered.length}</p>
        </div>
      </> : <div className="empty-state"><span className="empty-icon"><Icon name="search" size={28}/></span><h3>Nenhum projeto com esses filtros.</h3><p>Tente outro termo ou remova alguns filtros.</p><button className="button button-dark" onClick={clear}>Limpar filtros<Icon name="x" size={16}/></button></div>}
    </section>

    <section className="publish-band container" aria-labelledby="publish-title">
      <div><span className="eyebrow">Sua vez</span><h2 id="publish-title">Publique o que você está aprendendo.</h2><p>Um exercício, um experimento ou um app completo. Você pode editar depois.</p></div>
      <Link href="/meus-projetos/novo" className="button button-invert">Publicar projeto<Icon name="arrow-up-right" size={18}/></Link>
      <span className="publish-band-mark" aria-hidden="true">✳</span>
    </section>
  </main>;
}
