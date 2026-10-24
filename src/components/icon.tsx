import type { CSSProperties } from "react";
export type IconName = "arrow-up-right" | "arrow-right" | "arrow-left" | "plus" | "search" | "chevron-down" | "heart" | "star" | "grid" | "x" | "menu" | "github" | "external" | "logout" | "edit" | "trash" | "check" | "filter" | "code" | "users" | "eye" | "clock" | "link" | "mail" | "loader" | "upload" | "leaf" | "globe" | "sun" | "book";
const paths: Record<IconName, React.ReactNode> = {
  "arrow-up-right": <><path d="M6 18 18 6M6 6h12v12" /></>,
  "arrow-right": <path d="M4 12h16m-6-6 6 6-6 6" />,
  "arrow-left": <path d="M20 12H4m6-6-6 6 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></>,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
  star: <path d="m12 3 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3-5.7-3-5.7 3 1.1-6.3-4.6-4.5 6.4-.9L12 3Z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  x: <path d="m6 6 12 12M6 18 18 6" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  github: <><path d="M9 19c-4.3 1.3-4.3-2.2-6-2.6m12 5v-3.3a2.9 2.9 0 0 0-.8-2.2c2.8-.3 5.8-1.4 5.8-6.3A4.9 4.9 0 0 0 18.7 6a4.5 4.5 0 0 0-.1-3.3S17.6 2.4 15 4a13.4 13.4 0 0 0-6 0C6.4 2.4 5.4 2.7 5.4 2.7A4.5 4.5 0 0 0 5.3 6 4.9 4.9 0 0 0 4 9.6c0 4.9 3 6 5.8 6.3a2.9 2.9 0 0 0-.8 2.2v3.3"/></>,
  external: <><path d="M15 3h6v6m0-6L10 14"/><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></>,
  logout: <><path d="M9 4H4v16h5m5-4 4-4-4-4m-6 4h13"/></>,
  edit: <><path d="m15 4 5 5M4 15 15.5 3.5a2.8 2.8 0 0 1 4 4L8 19l-5 2 1-6Z"/></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></>,
  check: <path d="m5 12 4 4L19 6" />,
  filter: <><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="17" r="2" fill="currentColor"/></>,
  code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/></>,
  users: <><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-17a3 3 0 0 1 0 6m2 5a5 5 0 0 1 3 4v2"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  link: <><path d="m10 13 4-4m-5 7-2 2a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0m0 8a3.5 3.5 0 0 0 5 0l5-5a3.5 3.5 0 0 0-5-5l-2 2"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/></>,
  loader: <path d="M21 12a9 9 0 1 1-9-9" />,
  upload: <><path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/></>,
  leaf: <><path d="M20 3c-9-1-17 3-15 11s15 7 15-11ZM5 20 15 9"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>,
  book: <><path d="M12 6C8 3 4 4 2 5v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-2-1-6-2-10 1Zm0 0v14"/></>,
};
export function Icon({ name, size = 20, className = "", style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">{paths[name]}</svg>;
}
