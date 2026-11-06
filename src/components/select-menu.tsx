"use client";

import { Icon } from "./icon";
import { DropdownMenu, DropdownRadioGroup, DropdownRadioItem, DropdownItemIndicator } from "./dropdown-menu";

export function SelectMenu<Value extends string>({ value, onChange, options, label, disabled = false, className = "" }: {
  value: Value; onChange: (value: Value) => void; options: readonly { value: Value; label: string }[];
  label: string; disabled?: boolean; className?: string;
}) {
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <div className={`sort-field ${className}`}>
      <DropdownMenu className="sort-menu select-menu" initialFocus='[aria-checked="true"]' trigger={<button
        type="button"
        className="sort-trigger"
        aria-label={`${label}: ${selected.label}`}
        disabled={disabled}
      >
        <span>{selected.label}</span>
        <Icon name="chevron-down" size={15}/>
      </button>}>
        <DropdownRadioGroup value={value} onValueChange={next => onChange(next as Value)}>
          {options.map((option) => (
            <DropdownRadioItem
              className="dropdown-item"
              key={option.value}
              value={option.value}
            >
              <span>{option.label}</span>
              <DropdownItemIndicator className="dropdown-check"><Icon name="check" size={18}/></DropdownItemIndicator>
            </DropdownRadioItem>
          ))}
        </DropdownRadioGroup>
      </DropdownMenu>
    </div>
  );
}
