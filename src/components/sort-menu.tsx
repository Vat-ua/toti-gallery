"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Icon } from "./icon";
import { useDropdownPosition } from "./use-dropdown-position";

const options = [
  { value: "recent", label: "Recentes" },
  { value: "likes", label: "Mais curtidos" },
  { value: "az", label: "A–Z" },
] as const;

export type SortOrder = (typeof options)[number]["value"];

type SortMenuProps = {
  value: SortOrder;
  onChange: (value: SortOrder) => void;
};

export function SortMenu({ value, onChange }: SortMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDropdownPosition(open, rootRef, menuRef);
  const menuId = useId();
  const selected = options.find((option) => option.value === value)!;

  useEffect(() => {
    if (!open) return;
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
      ?.focus({ preventScroll: true });

    function dismiss(event: Event) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("focusin", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("focusin", dismiss);
    };
  }, [open, value]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "Tab" && open) {
      setOpen(false);
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      setOpen(true);
      return;
    }
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    if (!items?.length) return;
    const index = Array.from(items).indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
    items[next].focus({ preventScroll: true });
  }

  return (
    <div className="sort-field" ref={rootRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className="sort-trigger"
        ref={triggerRef}
        id={`${menuId}-trigger`}
        aria-label={`Ordenar projetos: ${selected.label}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selected.label}</span>
        <Icon name="chevron-down" size={15}/>
      </button>
      {open && (
        <div className="dropdown-menu sort-menu" ref={menuRef} id={menuId} role="menu" aria-labelledby={`${menuId}-trigger`}>
          {options.map((option) => (
            <button
              type="button"
              className="dropdown-item"
              role="menuitemradio"
              key={option.value}
              aria-checked={option.value === value}
              tabIndex={-1}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
                triggerRef.current?.focus({ preventScroll: true });
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Icon name="check" size={18}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
