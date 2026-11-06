import type { Person, Project, PublicationTurma } from "./types";
import type { ProjectLinks } from "./project-links";

export const demoPerson: Person = {
  id: "demo-alex", slug: "alex-oliveira", name: "Alex Oliveira",
  cohort: "Turma 58", cohorts: ["Turma 58"], courseName: "Full Stack", year: 2026,
  bio: "Estou aprendendo desenvolvimento web e reunindo aqui meus exercícios e projetos. Gosto de transformar ideias simples em interfaces úteis e acessíveis.",
  avatar: null, github: "https://github.com/", linkedin: "https://www.linkedin.com/", turmaId: "demo-turma",
};
export const demoTurmas: PublicationTurma[] = [{ id: "demo-turma", name: "Turma 58", number: 58, courseName: "Full Stack" }];
export const demoLinks: ProjectLinks = {
  list: "/demo", create: "/demo/novo", profile: () => "/demo/perfil",
  view: project => `/demo/projetos/${encodeURIComponent(project.id)}`,
  edit: id => `/demo/projetos/${encodeURIComponent(id)}/editar`,
  inspect: id => `/demo/projetos/${encodeURIComponent(id)}`,
};

export type DemoProject = Omit<Project, "author" | "authors" | "imageUrl"> & { image: Blob | null };
export type DemoWorkspace = { schemaVersion: 1; generation: string; projects: DemoProject[] };

export function initialDemo(): DemoWorkspace {
  const base = { version: 1, turmaId: "demo-turma", image: null, featured: false, isFinal: false,
    githubUrl: "https://github.com/", liveUrl: null, likes: 0, liked: false, visibility: "published" as const };
  return { schemaVersion: 1, generation: crypto.randomUUID(), projects: [
    { ...base, id: "meu-portfolio", slug: "meu-portfolio", title: "Meu portfólio", technologies: ["HTML", "CSS", "JavaScript"], coverStyle: "books", createdAt: "2026-10-22T12:00:00.000Z",
      description: "Meu primeiro portfólio pessoal, criado para reunir os trabalhos que desenvolvi durante o curso.\n\n### O que pratiquei\n\n- Estrutura semântica com HTML\n- Layout responsivo com Grid e Flexbox\n- Navegação por teclado e estados de foco\n\nA página apresenta meus projetos, uma breve introdução e formas de contato. O desafio principal foi manter a leitura confortável tanto no celular quanto no computador." },
    { ...base, id: "lista-de-tarefas", slug: "lista-de-tarefas", title: "Lista de tarefas", technologies: ["React", "TypeScript", "CSS"], coverStyle: "weather", createdAt: "2026-10-28T12:00:00.000Z",
      description: "Uma aplicação para organizar as tarefas do dia. É possível adicionar atividades, marcar o que já foi concluído e filtrar a lista.\n\n### Funcionalidades\n\n- Criar e remover tarefas\n- Separar atividades pendentes e concluídas\n- Manter a lista após atualizar a página\n\nUsei **React e TypeScript** para praticar componentes, eventos e atualização de estado. As tarefas ficam no `localStorage`.\n\n### Um trecho do código\n\nEsta função calcula quantas tarefas ainda estão pendentes:\n\n```javascript\nfunction contarPendentes(tarefas) {\n  return tarefas.filter(\n    tarefa => !tarefa.concluida\n  ).length;\n}\n```\n\n> Uma lista pequena, com ações claras e uma tarefa de cada vez.\n\nEssa ideia guiou as decisões de interface. Também cuidei das mensagens de lista vazia e da experiência em telas pequenas." },
  ] };
}
