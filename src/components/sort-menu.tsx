"use client";

import { SelectMenu } from "./select-menu";
import type { GalleryFilters } from "@/lib/gallery-filters";

const options = [
  { value: "recent", label: "Recentes" },
  { value: "likes", label: "Mais curtidos" },
  { value: "az", label: "A–Z" },
] as const;

const communityOptions = [
  { value: "az", label: "Nome: A–Z" },
  { value: "projects", label: "Mais projetos" },
  { value: "likes", label: "Mais curtidas" },
] as const;

export function SortMenu({ value, onChange, mode = "gallery" }: {
  value: GalleryFilters["sort"]; onChange: (value: GalleryFilters["sort"]) => void; mode?: "gallery" | "community";
}) {
  return <SelectMenu value={value} onChange={onChange} options={mode === "community" ? communityOptions : options}
    label={mode === "community" ? "Ordenar pessoas" : "Ordenar projetos"}/>;
}
