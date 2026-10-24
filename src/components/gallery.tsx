"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Person, Project } from "@/lib/types";
import { TECHNOLOGIES } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar } from "./ui";
import { ProjectCard } from "./project-card";

export function Gallery({ projects, people }: { projects: Project[]; people: Person[] }) {
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const [cohort, setCohort] = useState("");
  const [techs, setTechs] = useState<string[]>([]);
  const [sort, setSort] = useState("recent");
  const [featured, setFeatured] = useState(false);
  const [visible, setVisible] = useState(6);
  const [techOpen, setTechOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
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
  const hasFilters = !!(query || cohort || techs.length || featured);
  useEffect(() => {
    function close(event: MouseEvent) { if (filterRef.current && !filterRef.current.contains(event.target as Node)) setTechOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === "Escape") setTechOpen(false); }
    document.addEventListener("click", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", escape); };
  }, []);
  const cohorts = [...new Set(people.map(p => `${p.cohort} · ${p.year}`))].sort().reverse();
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = useMemo(() => projects.filter(project => {
    const text = normalize(`${project.title} ${project.summary} ${project.author.name} ${project.technologies.join(" ")}`);
    return (!search || text.includes(normalize(search))) && (!cohort || `${project.author.cohort} · ${project.author.year}` === cohort) && (!featured || project.featured) && techs.every(tech => project.technologies.includes(tech));
  }).sort((a, b) => sort === "likes" ? b.likes - a.likes : sort === "az" ? a.title.localeCompare(b.title, "pt-BR") : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [projects, search, cohort, featured, techs, sort]);
  function clear() { setQuery(""); setCohort(""); setTechs([]); setFeatured(false); setVisible(6); }
  function toggleTech(tech: string) { setTechs(current => current.includes(tech) ? current.filter(t => t !== tech) : [...current, tech]); setVisible(6); }
  return <main id="conteudo" className="container gallery-page"><section className="gallery-hero" aria-labelledby="hero-title"><div className="hero-main"><div className="eyebrow"><span className="eyebrow-dot"/> DIFERENTES HISTÓRIAS. NOVAS POSSIBILIDADES.</div><h1 id="hero-title">Ideias que ganham<br/>vida em <span className="hero-highlight">código<span className="highlight-dot">.</span><svg viewBox="0 0 235 15" aria-hidden="true"><path d="M3 10c55-10 149-9 229-3"/></svg></span></h1></div><div className="hero-aside"><span className="hero-spark" aria-hidden="true">✳</span><p>Do primeiro “Olá, mundo!” ao próximo grande projeto. Descubra o que a comunidade Toti está criando.</p><Link href="/comunidade" className="hero-community"><span className="avatar-stack">{people.slice(0, 4).map(person => <Avatar person={person} key={person.id} size={35}/>)}</span><span>Gente de todo lugar.<br/><strong>Talento sem fronteiras.</strong></span><Icon name="arrow-up-right" size={17}/></Link></div></section><section className="gallery-section" aria-label="Galeria de projetos"><div className="gallery-tabs-row"><div className="gallery-tabs"><button className={!featured ? "gallery-tab selected" : "gallery-tab"} onClick={() => { setFeatured(false); setVisible(6); }} aria-pressed={!featured}><Icon name="grid" size={16}/>Todos os projetos</button><button className={featured ? "gallery-tab selected" : "gallery-tab"} onClick={() => { setFeatured(true); setVisible(6); }} aria-pressed={featured}><Icon name="star" size={17}/>Em destaque</button></div><span className="gallery-caption"><span>✳</span> Cada projeto, um novo começo.</span></div><div className="gallery-toolbar"><div className="search-field"><Icon name="search" size={19}/><input ref={searchRef} aria-label="Buscar projetos" placeholder="Busque uma ideia, tecnologia ou pessoa..." value={query} onChange={event => { setQuery(event.target.value); setVisible(6); }}/>{query && <button onClick={() => setQuery("")} aria-label="Limpar busca"><Icon name="x" size={15}/></button>}<kbd>/</kbd></div><div className="select-wrap cohort-select"><Icon name="users" size={17}/><select aria-label="Filtrar por turma e ano" value={cohort} onChange={event => { setCohort(event.target.value); setVisible(6); }}><option value="">Todas as turmas</option>{cohorts.map(value => <option value={value} key={value}>{value}</option>)}</select><Icon name="chevron-down" size={14}/></div><div className="tech-filter" ref={filterRef}><button className={`filter-trigger ${techs.length ? "filter-applied" : ""}`} onClick={() => setTechOpen(!techOpen)} aria-expanded={techOpen} aria-controls="technology-options"><Icon name="code" size={18}/><span>{techs.length ? `${techs.length} tecnologia${techs.length > 1 ? "s" : ""}` : "Tecnologias"}</span><Icon name="chevron-down" size={14}/></button>{techOpen && <div className="dropdown-menu tech-options" id="technology-options"><div className="filter-heading"><strong>Feito com o quê?</strong>{techs.length > 0 && <button onClick={() => setTechs([])}>Limpar</button>}</div><p>Combine tecnologias para descobrir projetos.</p>{TECHNOLOGIES.map(tech => <label key={tech}><input type="checkbox" checked={techs.includes(tech)} onChange={() => toggleTech(tech)}/><span>{tech}</span><small>{projects.filter(p => p.technologies.includes(tech)).length}</small></label>)}<button className="button button-dark filter-done" onClick={() => setTechOpen(false)}>Ver {filtered.length} projetos<Icon name="arrow-right" size={15}/></button></div>}</div><div className="select-wrap sort-select"><select aria-label="Ordenar projetos" value={sort} onChange={event => setSort(event.target.value)}><option value="recent">Mais recentes</option><option value="likes">Mais curtidos</option><option value="az">De A a Z</option></select><Icon name="chevron-down" size={14}/></div></div>{techs.length > 0 && <div className="active-filters">{techs.map(tech => <button key={tech} onClick={() => toggleTech(tech)}>{tech}<Icon name="x" size={12}/></button>)}</div>}<div className="gallery-results"><p aria-live="polite"><strong>{filtered.length} {filtered.length === 1 ? "projeto" : "projetos"}</strong> {hasFilters ? "para você descobrir" : "e muitas ideias para explorar"}{hasFilters && <button className="clear-filters" onClick={clear}>Limpar filtros <Icon name="x" size={12}/></button>}</p><span className="results-note">Aprender. Criar. Compartilhar.</span></div>{filtered.length > 0 ? <><div className={`project-grid ${search !== query ? "is-searching" : ""}`}>{filtered.slice(0, visible).map(project => <ProjectCard key={project.id} project={project}/>)}</div><div className="load-more-area">{visible < filtered.length ? <button className="button button-outline load-more" onClick={() => setVisible(value => value + 6)}>Explorar mais projetos<Icon name="arrow-right" size={17}/></button> : <span className="end-of-gallery">Por enquanto, é isso. A próxima ideia pode ser a sua. <span>✳</span></span>}<p>Mostrando {Math.min(visible, filtered.length)} de {filtered.length} projetos</p></div></> : <div className="empty-state"><span className="empty-icon"><Icon name="search" size={30}/></span><h2>Nenhum projeto por aqui. Ainda.</h2><p>Tente outra palavra ou combine menos filtros.<br/>Uma boa ideia pode estar logo ali.</p><button className="button button-dark" onClick={clear}>Explorar todos os projetos<Icon name="arrow-right" size={16}/></button></div>}</section><section className="community-cta"><span className="cta-spark" aria-hidden="true">✳</span><div><span className="eyebrow">TODO COMEÇO CONTA</span><h2>Sua ideia também merece estar aqui.</h2><p>Do primeiro exercício ao projeto final. Compartilhe seu próximo passo.</p></div><Link href="/meus-projetos/novo" className="button button-dark">Compartilhar meu projeto<Icon name="arrow-up-right" size={18}/></Link></section></main>;
}
