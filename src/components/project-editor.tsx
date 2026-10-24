"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COVER_STYLES, TECHNOLOGIES, type Person, type Project } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";
import { ProjectCover } from "./project-cover";

const styles = [
  { name: "Lavanda", color: "#e7e1f0" }, { name: "Natureza", color: "#dce6ce" }, { name: "Biblioteca", color: "#dcd2ed" }, { name: "Pêssego", color: "#f0cfbe" }, { name: "Comunidade", color: "#cedcec" }, { name: "Sol", color: "#efe3cb" }, { name: "Código", color: "#d9cedf" },
];
export function ProjectEditor({ user, project }: { user: Person; project?: Project }) {
  const router = useRouter();
  const notify = useToast();
  const [title, setTitle] = useState(project?.title || "");
  const [summary, setSummary] = useState(project?.summary || "");
  const [description, setDescription] = useState(project?.description || "");
  const [technologies, setTechnologies] = useState<string[]>(project?.technologies || []);
  const [category, setCategory] = useState(project?.category || "Front-end");
  const [coverStyle, setCoverStyle] = useState(project?.coverStyle || "abstract");
  const [imageUrl, setImageUrl] = useState(project?.imageUrl || "");
  const [githubUrl, setGithubUrl] = useState(project?.githubUrl || "");
  const [liveUrl, setLiveUrl] = useState(project?.liveUrl || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  function toggleTech(tech: string) {
    if (technologies.includes(tech)) setTechnologies(technologies.filter(value => value !== tech));
    else if (technologies.length < 8) setTechnologies([...technologies, tech]);
    else notify("Selecione no máximo 8 tecnologias.", true);
  }
  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      notify("Escolha uma imagem JPG, PNG ou WebP de até 2 MB.", true);
      event.target.value = ""; return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => { setImageUrl(String(reader.result)); setUploading(false); notify("Imagem adicionada à prévia."); };
    reader.onerror = () => { setUploading(false); notify("Não foi possível ler a imagem. Tente outra.", true); };
    reader.readAsDataURL(file);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!technologies.length) { setError("Selecione pelo menos uma tecnologia usada no projeto."); setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30); return; }
    setPending(true);
    try {
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", { method: project ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, summary, description, technologies, category, coverStyle, imageUrl, githubUrl, liveUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar seu projeto.");
      notify(project ? "Projeto atualizado. Sua história continua!" : "Projeto publicado! Sua ideia agora faz parte da galeria.");
      router.push(`/projetos/${data.slug}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente."); setPending(false); setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30); }
  }
  return <main id="conteudo" className="container inner-page editor-page"><Link href="/meus-projetos" className="back-link"><Icon name="arrow-left" size={16}/>Voltar para meus projetos</Link><div className="editor-heading"><span className="eyebrow"><span className="eyebrow-dot"/> TODO PROJETO TEM UMA HISTÓRIA</span><h1>{project ? "Uma ideia que continua evoluindo." : "Vamos dar vida à sua ideia?"}</h1><p>{project ? "Atualize os detalhes e compartilhe seu próximo passo." : "Pequeno ou grande, seu projeto merece ser visto. Conte um pouco sobre ele."}</p></div><div className="editor-layout"><form className="editor-form" onSubmit={submit}><fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><section className="editor-form-section"><h2>O começo da história</h2><p>Apresente sua ideia de um jeito simples e com a sua cara.</p><div className="form-field"><div className="field-label-row"><label htmlFor="project-title">Nome do projeto <span className="required-dot">*</span></label><span>{title.length}/80</span></div><input id="project-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="Toda boa ideia começa com um nome" required minLength={3} maxLength={80}/></div><div className="form-field"><div className="field-label-row"><label htmlFor="project-summary">Em poucas palavras <span className="required-dot">*</span></label><span>{summary.length}/140</span></div><input id="project-summary" value={summary} onChange={event => setSummary(event.target.value)} placeholder="O que seu projeto faz de especial?" required minLength={10} maxLength={140}/></div><div className="form-field"><label htmlFor="project-description">A história por trás do código <span className="required-dot">*</span></label><textarea id="project-description" value={description} onChange={event => setDescription(event.target.value)} placeholder="Qual problema você queria resolver? O que aprendeu no caminho? Conte os desafios, as descobertas e os próximos passos." required minLength={30} maxLength={6000} rows={7}/><small>Use parágrafos para organizar sua história. Mínimo de 30 caracteres.</small></div></section><section className="editor-form-section"><h2>As peças que fizeram acontecer</h2><p>Quais tecnologias você usou para tirar essa ideia do papel?</p><div className="form-field"><label htmlFor="project-category">Tipo de projeto</label><select id="project-category" value={category} onChange={event => setCategory(event.target.value)}><option>Front-end</option><option>Full-stack</option></select></div><span className="form-label" id="technologies-label">Tecnologias <span className="required-dot">*</span></span><div className="editor-technology-options" role="group" aria-labelledby="technologies-label">{TECHNOLOGIES.map(tech => <button key={tech} type="button" className={`technology-option ${technologies.includes(tech) ? "selected" : ""}`} aria-pressed={technologies.includes(tech)} onClick={() => toggleTech(tech)}>{technologies.includes(tech) && <Icon name="check" size={12}/>} {tech}</button>)}</div></section><section className="editor-form-section"><h2>Uma capa com personalidade</h2><p>Não tem uma imagem? Escolha uma das nossas capas. A gente cuida do visual.</p><span className="form-label" id="cover-styles-label">Escolha um estilo</span><div className="cover-style-options" role="group" aria-labelledby="cover-styles-label">{COVER_STYLES.map((style, index) => <button key={style} type="button" className={`cover-style-option ${coverStyle === style && !imageUrl ? "selected" : ""}`} style={{ background: styles[index].color }} aria-label={`Capa ${styles[index].name}`} aria-pressed={coverStyle === style && !imageUrl} title={styles[index].name} onClick={() => { setCoverStyle(style); setImageUrl(""); if (fileRef.current) fileRef.current.value = ""; }}>{coverStyle === style && !imageUrl && <Icon name="check" size={16}/>}</button>)}</div><label className="upload-cover"><Icon name={uploading ? "loader" : "upload"} className={uploading ? "spinner" : ""} size={23}/><span>{uploading ? "Preparando sua imagem..." : imageUrl ? "Trocar imagem de capa" : "Ou envie sua própria imagem"}<small>JPG, PNG ou WebP · Até 2 MB · Formato horizontal</small></span><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={pending || uploading} aria-label="Enviar imagem de capa"/></label><div className="form-field" style={{ marginTop: 16, marginBottom: 0 }}><label htmlFor="project-image-url">Ou cole o endereço de uma imagem</label><input id="project-image-url" type="url" value={imageUrl.startsWith("data:") ? "" : imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="https://exemplo.com/minha-capa.jpg"/></div>{imageUrl && <button type="button" className="remove-image" onClick={() => { setImageUrl(""); if (fileRef.current) fileRef.current.value = ""; }}><Icon name="x" size={13}/>Remover imagem e usar capa padrão</button>}</section><section className="editor-form-section"><h2>Onde a ideia ganha vida</h2><p>Os links são opcionais, mas ajudam outras pessoas a explorar seu trabalho.</p><div className="form-field"><label htmlFor="project-github">Repositório no GitHub</label><input id="project-github" type="url" value={githubUrl} onChange={event => setGithubUrl(event.target.value)} placeholder="https://github.com/seu-usuario/seu-projeto" maxLength={2000}/></div><div className="form-field"><label htmlFor="project-live">Projeto ao vivo</label><input id="project-live" type="url" value={liveUrl} onChange={event => setLiveUrl(event.target.value)} placeholder="https://meu-projeto.vercel.app" maxLength={2000}/></div></section>{error && <div ref={errorRef} className="form-error" role="alert"><Icon name="x" size={16}/>{error}</div>}<div className="editor-submit"><Link href="/meus-projetos" className="button button-outline" aria-disabled={pending} onClick={event => { if (pending) event.preventDefault(); }}>Cancelar</Link><button className="button button-dark" type="submit" disabled={pending || uploading}>{pending ? <><Icon name="loader" size={17} className="spinner"/>Salvando sua ideia...</> : <>{project ? "Salvar alterações" : "Publicar meu projeto"}<Icon name="arrow-up-right" size={17}/></>}</button></div><p className="editor-submit-note">Seu projeto ficará público na galeria. Você pode editá-lo quando quiser.</p></fieldset></form><aside className="editor-preview"><span className="preview-eyebrow"><Icon name="eye" size={14}/>UMA PRÉVIA DA SUA PRÓXIMA CONQUISTA</span><ProjectCover title={title || "Sua próxima ideia"} style={coverStyle} imageUrl={imageUrl} category={category}/><h2 className="preview-title">{title || "O nome da sua ideia"}</h2><div className="preview-author"><Avatar person={user} size={24}/><span>{user.name} · {user.cohort}</span></div><div className="technology-tags">{technologies.length ? technologies.slice(0, 4).map(tech => <span className="technology-tag" key={tech}>{tech}</span>) : <span className="technology-tag">Feito com curiosidade</span>}{technologies.length > 4 && <span className="technology-tag">+{technologies.length - 4}</span>}</div><p className="preview-note">Não precisa ser perfeito para ser compartilhado. Cada projeto é uma parte importante da sua jornada. <span aria-hidden="true">✳</span></p></aside></div></main>;
}
