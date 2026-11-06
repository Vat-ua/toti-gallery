/** Stable public address base; suffixes are allocated when a profile is created. */
export function profileSlugBase(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 80).replace(/-+$/g, "") || "pessoa";
}
