import type { CSSProperties } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Bold,
  Check,
  ChevronDown,
  Clock,
  CodeXml,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  Heart,
  Heading3,
  Italic,
  LayoutGrid,
  Leaf,
  Link as LinkIcon,
  LoaderCircle,
  List,
  ListOrdered,
  LogOut,
  Mail,
  Menu,
  Moon,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";

export type IconName = "arrow-up-right" | "arrow-right" | "arrow-left" | "arrow-down" | "plus" | "search" | "chevron-down" | "heart" | "star" | "grid" | "x" | "menu" | "github" | "linkedin" | "external" | "logout" | "edit" | "trash" | "check" | "filter" | "code" | "database" | "user" | "users" | "eye" | "eye-off" | "restore" | "clock" | "link" | "mail" | "loader" | "upload" | "leaf" | "globe" | "sun" | "moon" | "book" | "spark" | "sliders" | "bold" | "italic" | "heading" | "list" | "list-ordered" | "quote";

const icons = {
  "arrow-up-right": ArrowUpRight,
  "arrow-right": ArrowRight,
  "arrow-left": ArrowLeft,
  "arrow-down": ArrowDown,
  "plus": Plus,
  "search": Search,
  "chevron-down": ChevronDown,
  "heart": Heart,
  "star": Star,
  "grid": LayoutGrid,
  "x": X,
  "menu": Menu,
  "external": ExternalLink,
  "logout": LogOut,
  "edit": Pencil,
  "trash": Trash2,
  "check": Check,
  "filter": SlidersHorizontal,
  "code": CodeXml,
  "database": Database,
  "user": User,
  "users": Users,
  "eye": Eye,
  "eye-off": EyeOff,
  "restore": RotateCcw,
  "clock": Clock,
  "link": LinkIcon,
  "mail": Mail,
  "loader": LoaderCircle,
  "upload": Upload,
  "leaf": Leaf,
  "globe": Globe,
  "sun": Sun,
  "moon": Moon,
  "book": BookOpen,
  "bold": Bold,
  "italic": Italic,
  "heading": Heading3,
  "list": List,
  "list-ordered": ListOrdered,
  "quote": Quote,
  "spark": Sparkles,
  "sliders": SlidersHorizontal,
} satisfies Record<Exclude<IconName, "github" | "linkedin">, typeof ArrowUpRight>;

type IconProps = { name: IconName; size?: number; className?: string; style?: CSSProperties };

export function Icon({ name, size = 20, className = "", style }: IconProps) {
  // Service logos are brand assets; Lucide v1 intentionally excludes them.
  if (name === "github") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true" focusable="false"><path d="M9 19c-4.3 1.3-4.3-2.2-6-2.6m12 5v-3.3a2.9 2.9 0 0 0-.8-2.2c2.8-.3 5.8-1.4 5.8-6.3A4.9 4.9 0 0 0 18.7 6a4.5 4.5 0 0 0-.1-3.3S17.6 2.4 15 4a13.4 13.4 0 0 0-6 0C6.4 2.4 5.4 2.7 5.4 2.7A4.5 4.5 0 0 0 5.3 6 4.9 4.9 0 0 0 4 9.6c0 4.9 3 6 5.8 6.3a2.9 2.9 0 0 0-.8 2.2v3.3"/></svg>;
  }
  // Lucide 0.468.0 icons/linkedin.svg; license: public/icons/LICENSE-LUCIDE.txt.
  if (name === "linkedin") {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true" focusable="false">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
      <rect width="4" height="12" x="2" y="9"/>
      <circle cx="4" cy="4" r="2"/>
    </svg>;
  }
  const LucideIcon = icons[name];
  return <LucideIcon size={size} strokeWidth={1.65} className={className} style={style} aria-hidden="true" focusable="false"/>;
}
