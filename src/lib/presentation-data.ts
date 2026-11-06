import type { IconName } from "@/components/icon";

export const presentationTabs = [
  { id: "projeto", label: "O projeto" },
  { id: "pratica", label: "Na prática" },
  { id: "administracao", label: "Administração" },
  { id: "tecnologia", label: "Tecnologia" },
] as const;
export type PresentationTab = typeof presentationTabs[number]["id"];

export const presentationImages = {
  galeria: { width: 1440, height: 960 },
  editor: { width: 1440, height: 960 },
  projeto: { width: 1440, height: 960 },
  perfil: { width: 1440, height: 960 },
  turmas: { width: 1280, height: 816 },
  estudantes: { width: 1280, height: 1123 },
  projetos: { width: 1280, height: 851 },
  administradores: { width: 1280, height: 816 },
} as const;
export type PresentationImage = keyof typeof presentationImages;

export const studentSteps = [
  { title: "Prepare a publicação", text: "Nome, descrição com Markdown, tecnologias e repositório. Escolha uma capa pronta ou envie uma imagem e ajuste o enquadramento.", image: "editor", alt: "Editor de projeto com formulário e prévia da capa" },
  { title: "Reconheça toda a equipe", text: "Uma pessoa publica e seleciona os colegas da mesma turma. O trabalho aparece uma única vez na galeria, com os créditos de todos os autores.", image: "projeto", alt: "Página de um projeto final com seis autores, tecnologias e links" },
  { title: "Compartilhe o resultado", text: "O projeto também aparece nos perfis dos participantes. Cada estudante reúne seus trabalhos, sua apresentação e seus links de contato.", image: "perfil", alt: "Perfil de Alex Oliveira com projetos individuais e em equipe" },
] as const;

export const adminScreens: { id: "turmas" | "estudantes" | "projetos" | "administradores"; title: string; icon: IconName; text: string; capabilities: string[]; alt: string }[] = [
  { id: "turmas", title: "Turmas", icon: "users", text: "Organização por curso, número e ano. Uma turma arquivada preserva seus participantes e continua aceitando publicações.", capabilities: ["Criar, editar e arquivar turmas", "Vincular estudantes e revisar a importação de listas"], alt: "Administração de turmas com curso, ano, participantes e ações" },
  { id: "estudantes", title: "Estudantes", icon: "user", text: "Um cadastro por pessoa, mesmo quando ela participa de várias turmas. A administração acompanha o acesso e organiza os vínculos.", capabilities: ["Cadastrar, buscar e filtrar estudantes", "Gerar links de ativação e recuperação para envio manual"], alt: "Lista administrativa de estudantes com busca, filtros e estados de acesso" },
  { id: "projetos", title: "Projetos", icon: "grid", text: "Moderação sem apagar o trabalho dos autores. Publicações podem ser ocultadas e restauradas, com o motivo disponível para revisão.", capabilities: ["Localizar e visualizar publicações", "Ocultar ou restaurar projetos com contexto"], alt: "Moderação de projetos com ações de visualizar, ocultar e restaurar" },
  { id: "administradores", title: "Administradores", icon: "user", text: "O proprietário gerencia os acessos administrativos. Administradores cuidam das turmas, dos estudantes e das publicações.", capabilities: ["Adicionar administradores e acompanhar a ativação", "Conceder ou remover permissões administrativas"], alt: "Gestão de administradores com a conta protegida do proprietário" },
];

export const entities = [
  { id: "turmas", label: "Turmas", table: "gallery_turmas", fields: ["id · PK", "number · único", "course_name", "start_year"], text: "Cada turma tem um número único, um curso e um ano de início. Arquivar organiza a lista sem apagar estudantes ou projetos." },
  { id: "members", label: "Matrículas", table: "gallery_turma_members", fields: ["turma_id · PK / FK", "user_id · PK / FK", "joined_at"], text: "Relaciona pessoas e turmas. A chave composta impede duas matrículas iguais e permite que uma pessoa participe de várias turmas." },
  { id: "users", label: "Pessoas", table: "gallery_users", fields: ["id · PK", "slug · único", "name", "role / status"], text: "Uma identidade permanente reúne perfil, permissões e acesso. Google e senha se vinculam à mesma pessoa, sem duplicar o cadastro." },
  { id: "projects", label: "Projetos", table: "gallery_projects", fields: ["id · PK", "author_id · FK", "turma_id · FK", "version / is_final"], text: "Uma publicação pertence a uma turma e tem um responsável. Apenas ele edita ou exclui o projeto; a versão protege contra a perda de alterações paralelas." },
  { id: "authors", label: "Autorias", table: "gallery_project_authors", fields: ["project_id · PK / FK", "user_id · PK / FK"], text: "Registra todos os autores, incluindo o responsável. Os créditos não dependem de uma matrícula continuar ativa: mudar de turma não apaga a autoria." },
  { id: "likes", label: "Curtidas", table: "gallery_likes", fields: ["project_id · PK / FK", "visitor_key · PK"], text: "Relaciona um projeto ao identificador do navegador. A combinação é única: repetir a mesma intenção não adiciona outra curtida." },
] as const;
export type EntityId = typeof entities[number]["id"];
export const relations: { from: EntityId; to: EntityId; text: string }[] = [
  { from: "turmas", to: "members", text: "Uma turma reúne várias matrículas." },
  { from: "users", to: "members", text: "Uma pessoa pode ter várias matrículas." },
  { from: "turmas", to: "projects", text: "Uma turma reúne várias publicações." },
  { from: "users", to: "projects", text: "Uma pessoa é responsável por cada publicação." },
  { from: "projects", to: "authors", text: "Um projeto pode ter vários autores." },
  { from: "users", to: "authors", text: "Uma pessoa pode ser autora de vários projetos." },
  { from: "projects", to: "likes", text: "Um projeto pode receber várias curtidas." },
];
