"use client";

import { useId, useState } from "react";
import type { Person } from "@/lib/types";
import { Avatar } from "./ui";
import { Icon } from "./icon";

type Props = { people: Person[]; ownerId: string; selected: string[]; onChange: (ids: string[]) => void };

export function CoauthorPicker({ people, ownerId, selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const candidates = people.filter(person => person.id !== ownerId);
  const matches = candidates.filter(person => normalize(`${person.name} ${person.cohort}`).includes(normalize(query)));
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id]);
  }
  return <div className="coauthor-picker">
    <div className="form-field">
      <label htmlFor={inputId}>Coautores (opcional)</label>
      <input id={inputId} type="search" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }} placeholder="Buscar por nome"/>
    </div>
    {selected.length > 0 && <div className="coauthor-selected" role="group" aria-label="Coautores selecionados">
      {candidates.filter(person => selected.includes(person.id)).map(person => <button type="button" className="active-filter" key={person.id} onClick={() => toggle(person.id)} aria-label={`Remover coautor ${person.name}`}>{person.name}<Icon name="x" size={14}/></button>)}
    </div>}
    <div className="coauthor-options" role="group" aria-label="Selecionar coautores">
      {matches.map(person => <label className="checkbox-field coauthor-option" key={person.id}>
        <input type="checkbox" checked={selected.includes(person.id)} onChange={() => toggle(person.id)} aria-label={`${person.name}, ${person.cohort}`}/>
        <Avatar person={person} size={32}/><span>{person.name}<small>{person.cohort}</small></span>
      </label>)}
      {!matches.length && <p className="coauthor-empty">Nenhuma pessoa da sua turma encontrada.</p>}
    </div>
  </div>;
}
