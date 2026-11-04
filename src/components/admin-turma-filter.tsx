"use client";

import { useId, useState } from "react";
import type { AdminTurma } from "@/lib/admin-types";
import { Icon } from "./icon";
import { Popover } from "./popover";

export function AdminTurmaFilter({ value, onChange, turmas, includeWithoutTurma = false, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  turmas: Pick<AdminTurma, "id" | "name" | "archived">[];
  includeWithoutTurma?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const expanded = open && !disabled;
  const options = [
    { value: "all", label: "Todas as turmas" },
    ...(includeWithoutTurma ? [{ value: "none", label: "Sem turma" }] : []),
    ...turmas.map(turma => ({ value: turma.id, label: `${turma.name}${turma.archived ? " · Arquivada" : ""}` })),
  ];
  const selected = options.find(option => option.value === value) || options[0];

  return <div className="sort-field admin-filter-field">
    <Popover open={expanded} onOpenChange={setOpen} id={panelId} className="people-filter-panel admin-turma-panel"
      label="Filtrar por turma" initialFocus='[aria-pressed="true"]' scrollInitialFocus
      trigger={<button type="button" className="sort-trigger"
        aria-label={`Filtrar por turma: ${selected.label}`} disabled={disabled}>
        <span>{selected.label}</span><Icon name="chevron-down" size={16}/>
      </button>}>
      <div className="filter-choices" role="group" aria-label="Filtrar por turma">
        {options.map(option => <button key={option.value} type="button"
          className={`filter-choice ${selected.value === option.value ? "is-on" : ""}`}
          aria-pressed={selected.value === option.value} onClick={() => {
            setOpen(false);
            onChange(value === option.value ? "all" : option.value);
          }}>{option.label}</button>)}
      </div>
    </Popover>
  </div>;
}
