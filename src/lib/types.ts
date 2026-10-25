export type Person = {
  id: string;
  name: string;
  cohort: string;
  year: number;
  bio: string;
  avatar: string | null;
  github: string | null;
};

export type Project = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  technologies: string[];
  coverStyle: string;
  imageUrl: string | null;
  githubUrl: string | null;
  liveUrl: string | null;
  featured: boolean;
  isFinal: boolean;
  createdAt: string;
  author: Person;
  authors: Person[];
  likes: number;
  liked: boolean;
};

export const TECHNOLOGIES = ["HTML", "CSS", "JavaScript", "React", "Next.js", "TypeScript", "Node.js", "PostgreSQL", "MongoDB", "Python", "Tailwind CSS"];
export const COHORTS = ["Turma 25", "Turma 24", "Turma 23", "Turma 22", "Turma 21"];
export const COVER_STYLES = ["abstract", "eco", "books", "finance", "connect", "weather", "quiz"];
