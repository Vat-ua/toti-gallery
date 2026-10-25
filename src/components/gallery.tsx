"use client";

import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import type { Project } from "@/lib/types";
import { Icon } from "./icon";
import { ProjectCard } from "./project-card";
import { SortMenu } from "./sort-menu";
import { galleryFilterParams } from "@/lib/gallery-filters";
import { useGalleryFilters } from "./use-gallery-filters";
import { useDropdownPosition } from "./use-dropdown-position";

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
const cohortNumber = (value: string) => value.replace(/^Turma\s*/i, "");
const PAGE_SIZE = 9;
const filterGroups = [
  { id: "cohort", label: "Turma" },
  { id: "technology", label: "Tecnologias" },
] as const;

export function Gallery({ projects }: { projects: Project[] }) {
  const cohorts = useMemo(() => {
    return [...new Set(projects.map((project) => project.author.cohort))].sort(
      (a, b) => b.localeCompare(a, "pt-BR", { numeric: true }),
    );
  }, [projects]);
  const techOptions = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((project) =>
      project.technologies.forEach((tech) =>
        map.set(tech, (map.get(tech) || 0) + 1),
      ),
    );
    return [...map.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"),
    );
  }, [projects]);

  const filterOptions = useMemo(() => ({
    cohorts,
    technologies: techOptions.map(([tech]) => tech),
  }), [cohorts, techOptions]);
  const { filters, updateFilters, changeQuery, flushQuery } = useGalleryFilters(filterOptions);
  const { query, cohort, techs, sort, featured, finalOnly } = filters;
  const search = useDeferredValue(query);
  const filterKey = galleryFilterParams(filters).toString();
  const [page, setPage] = useState({ key: filterKey, visible: PAGE_SIZE });
  const visible = page.key === filterKey ? page.visible : PAGE_SIZE;
  if (page.key !== filterKey) setPage({ key: filterKey, visible: PAGE_SIZE });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterGroup, setFilterGroup] = useState<"cohort" | "technology">(
    "cohort",
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const filtersButtonRef = useRef<HTMLButtonElement>(null);
  const filterTabsRef = useRef<HTMLDivElement>(null);
  const filterPanelRef = useRef<HTMLDivElement>(null);
  useDropdownPosition(filtersOpen, filtersButtonRef, filterPanelRef);
  const hasFilters = !!(query || cohort || techs.length || featured || finalOnly);
  const activeFilterCount = (cohort ? 1 : 0) + techs.length + (finalOnly ? 1 : 0);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const element = event.target as HTMLElement;
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName) &&
        !element.isContentEditable
      ) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useLayoutEffect(() => {
    if (!filtersOpen) return;
    filterTabsRef.current
      ?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?.focus({ preventScroll: true });
  }, [filtersOpen]);

  useEffect(() => {
    if (!filtersOpen) return;
    function outside(event: Event) {
      const target = event.target;
      if (
        target instanceof Node &&
        !filterPanelRef.current?.contains(target) &&
        !filtersButtonRef.current?.contains(target)
      ) {
        setFiltersOpen(false);
      }
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


  const filtered = useMemo(
    () =>
      projects
        .filter((project) => {
          const text = normalize(
            `${project.title} ${project.summary} ${project.author.name} ${project.technologies.join(" ")}`,
          );
          return (
            (!search || text.includes(normalize(search))) &&
            (!cohort || project.author.cohort === cohort) &&
            (!featured || project.featured) &&
            (!finalOnly || project.isFinal) &&
            techs.every((tech) => project.technologies.includes(tech))
          );
        })
        .sort((a, b) =>
          sort === "likes"
            ? b.likes - a.likes
            : sort === "az"
              ? a.title.localeCompare(b.title, "pt-BR")
              : new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime(),
        ),
    [projects, search, cohort, featured, finalOnly, techs, sort],
  );

  const featuredCount = projects.filter((project) => project.featured).length;

  function clear() {
    updateFilters({ query: "", cohort: "", techs: [], featured: false, finalOnly: false });
  }
  function toggleTech(tech: string) {
    updateFilters((current) => ({
      ...current,
      techs: current.techs.includes(tech)
        ? current.techs.filter((item) => item !== tech)
        : [...current.techs, tech],
    }));
  }
  function switchFilterTab(
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = (index + 1) % filterGroups.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (index + filterGroups.length - 1) % filterGroups.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = filterGroups.length - 1;
    else return;
    event.preventDefault();
    setFilterGroup(filterGroups[next].id);
    filterTabsRef.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  }

  return (
    <main id="conteudo">
      <section className="hero container" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">
            O que a comunidade <em>está construindo</em>.
          </h1>
          <p className="hero-lead">
            Explore exercícios, experimentos e aplicações completas. Descubra
            novas ideias, conheça outros projetos e aprenda com outras pessoas.
          </p>
        </div>
      </section>

      <section
        className="gallery-section container"
        id="projetos"
        aria-labelledby="gallery-title"
      >
        <div className="gallery-head">
          <h2 id="gallery-title">
            Projetos<span className="gallery-title-dot">.</span>
          </h2>
          <div
            className="view-tabs"
            role="group"
            aria-label="Filtrar por destaque"
          >
            <button
              className={!featured ? "view-tab is-active" : "view-tab"}
              aria-pressed={!featured}
              onClick={() => {
                updateFilters({ featured: false });

              }}
            >
              Todos<span>{projects.length}</span>
            </button>
            <button
              className={featured ? "view-tab is-active" : "view-tab"}
              aria-pressed={featured}
              onClick={() => {
                updateFilters({ featured: true });

              }}
            >
              Destaques<span>{featuredCount}</span>
            </button>
          </div>
        </div>

        <div className="gallery-toolbar">
          <div className="controls">
            <div className="controls-row">
              <div className="search-field">
                <Icon name="search" size={20} />
                <input
                  ref={searchRef}
                  aria-label="Buscar projetos"
                  placeholder="Buscar por projeto, pessoa ou tecnologia"
                  value={query}
                  onBlur={flushQuery}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") flushQuery();
                  }}
                  onChange={(event) => {
                    changeQuery(event.target.value);

                  }}
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => changeQuery("")}
                    aria-label="Limpar busca"
                  >
                    <Icon name="x" size={16} />
                  </button>
                ) : (
                  <kbd>/</kbd>
                )}
              </div>
              <div className="filter-dropdown">
                <button
                  type="button"
                  ref={filtersButtonRef}
                  className={`filters-toggle ${filtersOpen || activeFilterCount ? "is-active" : ""}`}
                  aria-haspopup="dialog"
                  aria-expanded={filtersOpen}
                  aria-controls="project-filters"
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  <Icon name="sliders" size={18} />
                  <span>Filtros</span>
                  {activeFilterCount > 0 && (
                    <>
                      <span className="filter-count" aria-hidden="true">
                        {activeFilterCount}
                      </span>
                      <span className="sr-only">
                        {activeFilterCount} ativos
                      </span>
                    </>
                  )}
                  <Icon
                    name="chevron-down"
                    size={16}
                    className={filtersOpen ? "is-open" : ""}
                  />
                </button>
                {filtersOpen && (
                  <div
                    className="dropdown-menu filter-panel"
                    id="project-filters"
                    ref={filterPanelRef}
                    role="dialog"
                    aria-label="Filtros de projetos"
                  >
                    <div
                      className="filter-tabs"
                      role="tablist"
                      aria-label="Tipos de filtro"
                      aria-orientation="vertical"
                      ref={filterTabsRef}
                    >
                      {filterGroups.map((group, index) => (
                        <button
                          type="button"
                          key={group.id}
                          role="tab"
                          id={`filter-tab-${group.id}`}
                          aria-controls={`filter-options-${group.id}`}
                          aria-selected={filterGroup === group.id}
                          tabIndex={filterGroup === group.id ? 0 : -1}
                          className={`filter-tab ${filterGroup === group.id ? "is-active" : ""}`}
                          onClick={() => setFilterGroup(group.id)}
                          onKeyDown={(event) => switchFilterTab(event, index)}
                        >
                          {group.label}
                          <span>
                            {group.id === "cohort"
                              ? (cohort ? 1 : 0) + (finalOnly ? 1 : 0) || ""
                              : techs.length || ""}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="filter-content">
                      <div
                        className="filter-options"
                        role="tabpanel"
                        id="filter-options-cohort"
                        aria-labelledby="filter-tab-cohort"
                        aria-hidden={filterGroup !== "cohort"}
                        inert={filterGroup !== "cohort"}
                      >
                        <div
                          className="filter-choices"
                          role="group"
                          aria-label="Filtrar por turma"
                        >
                          <button
                            type="button"
                            className={
                              !cohort ? "filter-choice is-on" : "filter-choice"
                            }
                            aria-pressed={!cohort}
                            onClick={() => {
                              updateFilters({ cohort: "" });

                            }}
                          >
                            Todas
                          </button>
                          {cohorts.map((value) => (
                            <button
                              type="button"
                              key={value}
                              className={
                                cohort === value
                                  ? "filter-choice is-on"
                                  : "filter-choice"
                              }
                              aria-pressed={cohort === value}
                              onClick={() => {
                                updateFilters({ cohort: cohort === value ? "" : value });

                              }}
                            >
                              Turma {cohortNumber(value)}
                            </button>
                          ))}
                        </div>
                        <label className="checkbox-field final-project-filter">
                          <input
                            type="checkbox"
                            checked={finalOnly}
                            onChange={(event) => {
                              updateFilters({ finalOnly: event.target.checked });

                            }}
                          />
                          <span>Somente projetos finais</span>
                        </label>
                      </div>
                      <div
                        className="filter-options"
                        role="tabpanel"
                        id="filter-options-technology"
                        aria-labelledby="filter-tab-technology"
                        aria-hidden={filterGroup !== "technology"}
                        inert={filterGroup !== "technology"}
                      >
                        <div
                          className="filter-choices"
                          role="group"
                          aria-label="Filtrar por tecnologia"
                        >
                          {techOptions.map(([tech]) => (
                            <button
                              type="button"
                              key={tech}
                              className={
                                techs.includes(tech)
                                  ? "filter-choice is-on"
                                  : "filter-choice"
                              }
                              aria-pressed={techs.includes(tech)}
                              onClick={() => toggleTech(tech)}
                            >
                              {tech}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <SortMenu value={sort} onChange={(sort) => updateFilters({ sort })}/>
            </div>
          </div>
          <p className="results-count" aria-live="polite" aria-atomic="true">
            <strong>{filtered.length}</strong>{" "}
            {filtered.length === 1 ? "projeto" : "projetos"}
          </p>
        </div>

        {hasFilters && (
          <div
            className="active-filters"
            role="group"
            aria-label="Filtros ativos"
          >
            {cohort && (
              <button
                type="button"
                className="active-filter"
                aria-label={`Remover filtro da turma ${cohortNumber(cohort)}`}
                onClick={() => {
                  updateFilters({ cohort: "" });

                }}
              >
                Turma {cohortNumber(cohort)}
                <Icon name="x" size={14} />
              </button>
            )}
            {finalOnly && (
              <button
                type="button"
                className="active-filter"
                aria-label="Remover filtro de projetos finais"
                onClick={() => {
                  updateFilters({ finalOnly: false });

                }}
              >
                Projetos finais
                <Icon name="x" size={14} />
              </button>
            )}
            {techs.map((tech) => (
              <button
                type="button"
                key={tech}
                className="active-filter"
                aria-label={`Remover filtro ${tech}`}
                onClick={() => toggleTech(tech)}
              >
                {tech}
                <Icon name="x" size={14} />
              </button>
            ))}
            <button type="button" className="clear-filters" onClick={clear}>
              Limpar tudo
            </button>
          </div>
        )}

        {filtered.length > 0 ? (
          <>
            <div
              className={`project-grid ${search !== query ? "is-searching" : ""}`}
            >
              {filtered.slice(0, visible).map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
            <div className="load-more-area">
              {visible < filtered.length ? (
                <button
                  className="button button-outline load-more"
                  onClick={() => setPage({ key: filterKey, visible: visible + PAGE_SIZE })}
                >
                  Carregar mais projetos
                  <Icon name="arrow-down" size={18} />
                </button>
              ) : (
                <>
                  <p className="end-of-gallery">
                    Você chegou ao fim da galeria.
                  </p>
                  <Link href="/meus-projetos/novo" className="end-link">
                    Publicar um projeto
                    <Icon name="arrow-up-right" size={16} />
                  </Link>
                </>
              )}
              <p className="load-count">
                Mostrando {Math.min(visible, filtered.length)} de{" "}
                {filtered.length}
              </p>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span className="empty-icon">
              <Icon name="search" size={28} />
            </span>
            <h3>Nenhum projeto com esses filtros.</h3>
            <p>Tente outro termo ou remova alguns filtros.</p>
            <button className="button button-dark" onClick={clear}>
              Limpar filtros
              <Icon name="x" size={16} />
            </button>
          </div>
        )}
      </section>

      <div className="container">
        <section className="publish-band" aria-labelledby="publish-title">
          <div>
            <span className="eyebrow">Sua vez</span>
            <h2 id="publish-title">Publique o que você está aprendendo.</h2>
            <p>Pode ser um exercício simples, um experimento ou até uma aplicação completa.</p>
          </div>
          <Link href="/meus-projetos/novo" className="button button-invert">
            Publicar projeto
            <Icon name="arrow-up-right" size={18} />
          </Link>
          <span className="publish-band-mark" aria-hidden="true">
            ✳
          </span>
        </section>
      </div>
    </main>
  );
}
