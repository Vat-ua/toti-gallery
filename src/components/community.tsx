"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CommunityPerson } from "@/lib/types";
import type { CollectionSnapshot } from "@/lib/collection-page";
import type { GalleryFilterOptions } from "@/lib/gallery-filters";
import { usePagedCollection } from "./use-paged-collection";
import { CollectionFeedback } from "./collection-feedback";
import { IntentLink } from "./intent-link";
import { Avatar } from "./ui";
import { Icon } from "./icon";
import { useGalleryFilters } from "./use-gallery-filters";
import { Popover } from "./popover";
import { SortMenu } from "./sort-menu";

export function Community({ initialPage, filterOptions }: { initialPage: CollectionSnapshot<CommunityPerson>; filterOptions: GalleryFilterOptions }) {
  const { filters: { query, cohort, sort }, updateFilters, changeQuery, flushQuery, changePage } = useGalleryFilters("community");
  const collection = usePagedCollection(initialPage, "/api/people", "community");
  const { items, total, loadedPages: loadedPage } = collection.data;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

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
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen} className="people-filter-panel"
              id="people-filters" label="Filtrar por turma" initialFocus='[aria-pressed="true"]' scrollInitialFocus trigger={<button type="button" className="filters-toggle">
              <span>{cohort || "Todas as turmas"}</span>
              <Icon name="chevron-down" size={16} className={filtersOpen ? "is-open" : ""}/>
            </button>}>
              <div className="filter-choices" role="group" aria-label="Filtrar por turma">
                <button type="button" className={`filter-choice ${!cohort ? "is-on" : ""}`} aria-pressed={!cohort} onClick={() => updateFilters({ cohort: "" })}>Todas as turmas</button>
                {filterOptions.cohorts.map(value => <button key={value} type="button" className={`filter-choice ${cohort === value ? "is-on" : ""}`} aria-pressed={cohort === value} onClick={() => updateFilters({ cohort: cohort === value ? "" : value })}>{value}</button>)}
              </div>
            </Popover>
          </div>
          <SortMenu mode="community" value={sort} onChange={sort => updateFilters({ sort })}/>
        </div>
      </div>
      <p className="results-count" aria-live="polite" aria-atomic="true"><strong>{total}</strong> {total === 1 ? "pessoa" : "pessoas"}</p>
    </div>
    {cohort && <div className="active-filters" aria-label="Filtros ativos">
      <button type="button" className="active-filter" aria-label={`Remover filtro ${cohort}`} onClick={() => updateFilters({ cohort: "" })}>{cohort}<Icon name="x" size={14}/></button>
      <button type="button" className="clear-filters" onClick={clear}>Limpar tudo</button>
    </div>}
    <CollectionFeedback error={collection.error} retry={collection.retry} pending={collection.pending} hasItems={items.length > 0}/>
    {total ? <><div className="people-grid" aria-busy={collection.pending}>{items.map(person => {
      const count = person.projectCount;
      const likes = person.totalLikes;
      return <IntentLink href={`/pessoas/${person.slug}`} key={person.id} className="person-card">
        <div className="person-card-top"><Avatar person={person} size={58}/><Icon name="arrow-up-right" size={23}/></div>
        <h2>{person.name}</h2>
        <div className="person-card-cohort">{person.cohort}</div>
        <p>{person.bio}</p>
        <div className="person-card-footer">
          <span className="person-card-projects"><Icon name="grid" size={13}/>{count} {count === 1 ? "projeto" : "projetos"}</span>
          {likes > 0 && <span className="person-card-likes">{likes} {likes === 1 ? "curtida" : "curtidas"}</span>}
        </div>
      </IntentLink>;
    })}</div>
      {collection.data.hasMore && <div className="load-more-area">
        <button type="button" className="button button-outline load-more" onClick={() => collection.error ? collection.retry() : changePage(loadedPage + 1)} disabled={!!collection.pending}>{collection.pending ? "Carregando..." : "Carregar mais pessoas"}<Icon name="arrow-down" size={18}/></button>
        <p className="load-count">Mostrando {items.length} de {total}</p>
      </div>}
    </> : !collection.pending && !collection.error ? <div className="empty-state">
      <span className="empty-icon"><Icon name="users" size={30}/></span>
      <h2>Nenhuma pessoa encontrada.</h2>
      <p>Tente outro nome ou turma.</p>
      <button type="button" className="button button-outline" onClick={clear}>Limpar filtros<Icon name="arrow-right" size={16}/></button>
    </div> : null}
  </main>;
}
