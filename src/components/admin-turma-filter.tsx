"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { AdminTurma } from "@/lib/admin-types";
import { Icon } from "./icon";
import { useDropdownPosition } from "./use-dropdown-position";

export function AdminTurmaFilter({ value, onChange, turmas, includeWithoutTurma = false, disabled = false }: {
  value: string;
  onChange: (value: string) => void;
  turmas: Pick<AdminTurma, "id" | "name" | "archived">[];
  includeWithoutTurma?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const expanded = open && !disabled;
  const options = [
    { value: "all", label: "Todas as turmas" },
    ...(includeWithoutTurma ? [{ value: "none", label: "Sem turma" }] : []),
    ...turmas.map(turma => ({ value: turma.id, label: `${turma.name}${turma.archived ? " · Arquivada" : ""}` })),
  ];
  const selected = options.find(option => option.value === value) || options[0];
  useDropdownPosition(expanded, rootRef, panelRef);

  useEffect(() => {
    if (!expanded) return;
    const selectedButton = panelRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    selectedButton?.focus({ preventScroll: true });
    if (selectedButton && panelRef.current) {
      panelRef.current.scrollTop = selectedButton.offsetTop - panelRef.current.clientHeight / 2 + selectedButton.clientHeight / 2;
    }

    function dismiss(event: Event) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);

  return <div className="sort-field admin-filter-field" ref={rootRef}>
    <button type="button" className="sort-trigger" ref={triggerRef} id={`${panelId}-trigger`}
      aria-label={`Filtrar por turma: ${selected.label}`} aria-haspopup="dialog"
      aria-expanded={expanded} aria-controls={expanded ? panelId : undefined}
      disabled={disabled} onClick={() => setOpen(current => !current)}>
      <span>{selected.label}</span><Icon name="chevron-down" size={16}/>
    </button>
    {expanded && <div className="dropdown-menu people-filter-panel" id={panelId} ref={panelRef}
      role="dialog" aria-labelledby={`${panelId}-heading`}>
      <span className="people-filter-heading" id={`${panelId}-heading`}>Turma</span>
      <div className="filter-choices" role="group" aria-label="Filtrar por turma">
        {options.map(option => <button key={option.value} type="button"
          className={`filter-choice ${selected.value === option.value ? "is-on" : ""}`}
          aria-pressed={selected.value === option.value} onClick={() => {
            setOpen(false);
            triggerRef.current?.focus({ preventScroll: true });
            onChange(value === option.value ? "all" : option.value);
          }}>{option.label}</button>)}
      </div>
    </div>}
  </div>;
}
