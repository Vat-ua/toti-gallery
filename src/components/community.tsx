"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Person, Project } from "@/lib/types";
import { Avatar } from "./ui";
import { Icon } from "./icon";
import { useGalleryFilters } from "./use-gallery-filters";
import { useDropdownPosition } from "./use-dropdown-position";

const PAGE_SIZE = 9;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function Community({ people, projects }: { people: Person[]; projects: Project[] }) {
  const filterOptions = useMemo(() => ({
    cohorts: [...new Set(people.map(person => person.cohort))].sort((a, b) => b.localeCompare(a, "pt-BR", { numeric: true })),
    technologies: [],
  }), [people]);
  const { filters: { query, cohort }, updateFilters, changeQuery, flushQuery } = useGalleryFilters(filterOptions);
  const filtered = useMemo(() => people.filter(person => normalize(person.name).includes(normalize(query)) && (!cohort || person.cohort === cohort)), [people, query, cohort]);
  const filterKey = JSON.stringify([query, cohort]);
  const [pagination, setPagination] = useState({ key: filterKey, visible: PAGE_SIZE });
  const visible = pagination.key === filterKey ? pagination.visible : PAGE_SIZE;
  if (pagination.key !== filterKey) setPagination({ key: filterKey, visible: PAGE_SIZE });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  useDropdownPosition(filtersOpen, filtersButtonRef, filterPanelRef);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useLayoutEffect(() => {
    if (filtersOpen) filterPanelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    function outside(event: Event) {
      const target = event.target;
      if (target instanceof Node && !filterPanelRef.current?.contains(target) && !filtersButtonRef.current?.contains(target)) setFiltersOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setFiltersOpen(false);
        filtersButtonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [filtersOpen]);

  function clear() {
    updateFilters({ query: "", cohort: "" });
  }
  return <main id="conteudo" className="container inner-page">
    <Link href="/" className="back-link"><Icon name="arrow-left" size={16}/>Projetos</Link>
    <div className="page-heading">
      <div className="page-intro"><h1>Comunidade</h1><p>Conheça as pessoas da comunidade e explore seus projetos.</p></div>
    </div>
    <div className="gallery-toolbar people-toolbar">
      <div className="controls people-controls">
        <div className="controls-row">
          <div className="search-field">
            <Icon name="search" size={20}/>
            <input ref={searchRef} aria-label="Buscar por nome" value={query} onChange={event => changeQuery(event.target.value)} onBlur={flushQuery} onKeyDown={event => { if (event.key === "Enter") flushQuery(); }} placeholder="Buscar por nome"/>
            {query ? <button type="button" aria-label="Limpar busca" onClick={() => changeQuery("")}><Icon name="x" size={16}/></button> : <kbd>/</kbd>}
          </div>
          <div className="filter-dropdown">
            <button type="button" ref={filtersButtonRef} className={`filters-toggle ${filtersOpen || cohort ? "is-active" : ""}`} aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="people-filters" onClick={() => setFiltersOpen(open => !open)}>
              <Icon name="sliders" size={18}/><span>Filtros</span>
              {cohort && <><span className="filter-count" aria-hidden="true">1</span><span className="sr-only">1 ativo</span></>}
              <Icon name="chevron-down" size={16} className={filtersOpen ? "is-open" : ""}/>
            </button>
            {filtersOpen && <div className="dropdown-menu people-filter-panel" id="people-filters" ref={filterPanelRef} role="dialog" aria-label="Filtros de pessoas">
              <span className="people-filter-heading">Turma</span>
              <div className="filter-choices" role="group" aria-label="Filtrar por turma">
                <button type="button" className={`filter-choice ${!cohort ? "is-on" : ""}`} aria-pressed={!cohort} onClick={() => updateFilters({ cohort: "" })}>Todas</button>
                {filterOptions.cohorts.map(value => <button key={value} type="button" className={`filter-choice ${cohort === value ? "is-on" : ""}`} aria-pressed={cohort === value} onClick={() => updateFilters({ cohort: cohort === value ? "" : value })}>{value}</button>)}
              </div>
            </div>}
          </div>
        </div>
      </div>
      <p className="results-count" aria-live="polite" aria-atomic="true"><strong>{filtered.length}</strong> {filtered.length === 1 ? "pessoa" : "pessoas"}</p>
    </div>
    {cohort && <div className="active-filters" aria-label="Filtros ativos">
      <button type="button" className="active-filter" aria-label={`Remover filtro ${cohort}`} onClick={() => updateFilters({ cohort: "" })}>{cohort}<Icon name="x" size={14}/></button>
      <button type="button" className="clear-filters" onClick={clear}>Limpar tudo</button>
    </div>}
    {filtered.length ? <><div className="people-grid">{filtered.slice(0, visible).map(person => {
      const authored = projects.filter(project => project.authors.some(author => author.id === person.id));
      const count = authored.length;
      const likes = authored.reduce((total, project) => total + project.likes, 0);
      return <Link href={`/pessoas/${person.id}`} key={person.id} className="person-card">
        <div className="person-card-top"><Avatar person={person} size={58}/><Icon name="arrow-up-right" size={23}/></div>
        <h2>{person.name}</h2>
        <div className="person-card-cohort">{person.cohort}</div>
        <p>{person.bio}</p>
        <div className="person-card-footer">
          <span className="person-card-projects"><Icon name="grid" size={13}/>{count} {count === 1 ? "projeto" : "projetos"}</span>
          {likes > 0 && <span className="person-card-likes">{likes} {likes === 1 ? "curtida" : "curtidas"}</span>}
        </div>
      </Link>;
    })}</div>
      {visible < filtered.length && <div className="load-more-area">
        <button type="button" className="button button-outline load-more" onClick={() => setPagination({ key: filterKey, visible: visible + PAGE_SIZE })}>Carregar mais pessoas<Icon name="arrow-down" size={18}/></button>
        <p className="load-count">Mostrando {Math.min(visible, filtered.length)} de {filtered.length}</p>
      </div>}
    </> : <div className="empty-state">
      <span className="empty-icon"><Icon name="users" size={30}/></span>
      <h2>Nenhuma pessoa encontrada.</h2>
      <p>Tente outro nome ou turma.</p>
      <button type="button" className="button button-outline" onClick={clear}>Limpar filtros<Icon name="arrow-right" size={16}/></button>
    </div>}
  </main>;
}
