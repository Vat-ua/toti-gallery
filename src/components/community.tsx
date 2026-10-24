"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Person, Project } from "@/lib/types";
import { Avatar } from "./ui";
import { Icon } from "./icon";

export function Community({ people, projects }: { people: Person[]; projects: Project[] }) {
  const [query, setQuery] = useState("");
  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filtered = useMemo(() => people.filter(person => `${person.name} ${person.cohort} ${person.year}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized)), [people, normalized]);
  return <main id="conteudo" className="container inner-page"><Link href="/" className="back-link"><Icon name="arrow-left" size={16}/>Voltar para a galeria</Link><div className="page-heading"><div className="community-intro"><span className="eyebrow"><span className="eyebrow-dot"/> O QUE NOS CONECTA VAI ALÉM DO CÓDIGO</span><h1>Gente de todo lugar.<br/><span>Talento sem fronteiras.</span></h1><p>Por trás de cada projeto, existe uma história. Conheça as pessoas que estão transformando curiosidade em código e construindo novos caminhos com a Toti.</p></div></div><div className="people-toolbar"><div className="search-field"><Icon name="search" size={18}/><input aria-label="Buscar pessoas ou turmas" value={query} onChange={event => setQuery(event.target.value)} placeholder="Encontre uma pessoa, turma ou ano..."/>{query && <button aria-label="Limpar busca" onClick={() => setQuery("")}><Icon name="x" size={15}/></button>}</div><span className="people-count" aria-live="polite">{filtered.length} {filtered.length === 1 ? "pessoa" : "pessoas"}, infinitas possibilidades.</span></div>{filtered.length ? <div className="people-grid">{filtered.map(person => {
    const count = projects.filter(p => p.author.id === person.id).length;
    return <Link href={`/pessoas/${person.id}`} key={person.id} className="person-card"><div className="person-card-top"><Avatar person={person} size={58}/><Icon name="arrow-up-right" size={23}/></div><h2>{person.name}</h2><div className="person-card-cohort">{person.cohort} · {person.year}</div><p>{person.bio}</p><div className="person-card-footer"><Icon name="grid" size={13}/>{count} {count === 1 ? "projeto publicado" : "projetos publicados"}<span>Conhecer o perfil ↗</span></div></Link>;
  })}</div> : <div className="empty-state"><span className="empty-icon"><Icon name="users" size={30}/></span><h2>Não encontramos esse talento.</h2><p>Experimente outro nome ou procure pela turma.</p><button className="button button-outline" onClick={() => setQuery("")}>Ver toda a comunidade<Icon name="arrow-right" size={16}/></button></div>}<section className="community-note"><span aria-hidden="true">✳</span><div><h2>Diferentes histórias. Um futuro em comum.</h2><p>A Toti conecta pessoas imigrantes, refugiadas e brasileiras às oportunidades da tecnologia.</p></div><a href="https://totidiversidade.com.br/" target="_blank" rel="noopener noreferrer" className="button button-outline">Conheça a Toti<Icon name="arrow-up-right" size={16}/></a></section></main>;
}
