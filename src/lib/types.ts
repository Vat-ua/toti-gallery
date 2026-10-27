export type Person = {
  id: string;
  name: string;
  cohort: string;
  year: number;
  bio: string;
  avatar: string | null;
  github: string | null;
  turmaId: string | null;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  description: string;
  technologies: string[];
  coverStyle: string;
  imageUrl: string | null;
  githubUrl: string;
  liveUrl: string | null;
  featured: boolean;
  isFinal: boolean;
  turmaId: string;
  createdAt: string;
  author: Person;
  authors: Person[];
  likes: number;
  liked: boolean;
};

export const TECHNOLOGIES = ["HTML", "CSS", "JavaScript", "React", "Next.js", "TypeScript", "Node.js", "Express", "PostgreSQL", "SQLite", "MongoDB", "Python", "Tailwind CSS"];
export const COVER_STYLES = ["abstract", "eco", "books", "finance", "connect", "weather", "quiz"];
