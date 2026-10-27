"use client";

import { SelectMenu } from "./select-menu";

const options = [
  { value: "recent", label: "Recentes" },
  { value: "likes", label: "Mais curtidos" },
  { value: "az", label: "A–Z" },
] as const;

export type SortOrder = (typeof options)[number]["value"];

export function SortMenu({ value, onChange }: { value: SortOrder; onChange: (value: SortOrder) => void }) {
  return <SelectMenu value={value} onChange={onChange} options={options} label="Ordenar projetos"/>;
}
