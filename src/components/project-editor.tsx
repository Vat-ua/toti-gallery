"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COVER_STYLES, TECHNOLOGIES, type Person, type Project } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";
import { ProjectCover } from "./project-cover";
import { CoauthorPicker } from "./coauthor-picker";

const styles = [
  { name: "Tipografia", color: "#f2e6d2", ink: "#17130f" },
  { name: "Blocos", color: "#d9f24b", ink: "#17130f" },
  { name: "Grade", color: "#7dd3fc", ink: "#17130f" },
  { name: "Arcos", color: "#26308f", ink: "#fffdf6" },
  { name: "Raios", color: "#17150f", ink: "#fffdf6" },
  { name: "Duo", color: "#ff7a4d", ink: "#17130f" },
  { name: "Código", color: "#1d1b26", ink: "#fffdf6" },
];
export function ProjectEditor({ user, project, people }: { user: Person; project?: Project; people: Person[] }) {
  const router = useRouter();
  const notify = useToast();
  const [title, setTitle] = useState(project?.title || "");
  const [summary, setSummary] = useState(project?.summary || "");
  const [description, setDescription] = useState(project?.description || "");
  const [technologies, setTechnologies] = useState<string[]>(project?.technologies || []);
  const [isFinal, setIsFinal] = useState(project?.isFinal ?? false);
  const [coauthorIds, setCoauthorIds] = useState<string[]>(project?.authors.filter(author => author.id !== user.id).map(author => author.id) || []);
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
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", { method: project ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, summary, description, technologies, isFinal, coauthorIds, coverStyle, imageUrl, githubUrl, liveUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar seu projeto.");
      notify(project ? "Projeto atualizado." : "Projeto publicado.");
      router.push(`/projetos/${data.slug}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente."); setPending(false); setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30); }
  }
  return <main id="conteudo" className="container inner-page">
    <Link href="/meus-projetos" className="back-link"><Icon name="arrow-left" size={16}/>Voltar para meus projetos</Link>
    <div className="editor-heading"><h1>{project ? "Editar projeto" : "Publicar projeto"}</h1></div>
    <div className="editor-layout">
      <form className="editor-form" onSubmit={submit}>
        <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="editor-form-section" aria-label="Informações do projeto">
            <div className="form-field">
              <div className="field-label-row"><label htmlFor="project-title">Nome do projeto <span className="required-dot">*</span></label><span>{title.length}/80</span></div>
              <input id="project-title" value={title} onChange={event => setTitle(event.target.value)} required minLength={3} maxLength={80}/>
            </div>
            <div className="form-field">
              <div className="field-label-row"><label htmlFor="project-summary">Resumo <span className="required-dot">*</span></label><span>{summary.length}/140</span></div>
              <input id="project-summary" value={summary} onChange={event => setSummary(event.target.value)} aria-describedby="project-summary-help" required minLength={10} maxLength={140}/>
              <small id="project-summary-help">Explique em uma frase o que o projeto faz.</small>
            </div>
            <div className="form-field">
              <label htmlFor="project-description">Descrição <span className="required-dot">*</span></label>
              <textarea id="project-description" value={description} onChange={event => setDescription(event.target.value)} aria-describedby="project-description-help" required minLength={30} maxLength={6000} rows={7}/>
              <small id="project-description-help">Conte o que o projeto faz, como foi desenvolvido e o que você aprendeu. De 30 a 6.000 caracteres.</small>
            </div>
            <label className="checkbox-field" htmlFor="project-is-final"><input id="project-is-final" type="checkbox" checked={isFinal} onChange={event => setIsFinal(event.target.checked)}/><span>Projeto final de curso</span></label>
          </section>
          <section className="editor-form-section">
            <h2 id="technologies-label">Tecnologias <span className="required-dot">*</span></h2>
            <div className="editor-technology-options" role="group" aria-labelledby="technologies-label">
              {TECHNOLOGIES.map(tech => <button key={tech} type="button" className={`technology-option ${technologies.includes(tech) ? "selected" : ""}`} aria-pressed={technologies.includes(tech)} onClick={() => toggleTech(tech)}>{technologies.includes(tech) && <Icon name="check" size={12}/>} {tech}</button>)}
            </div>
          </section>
          <section className="editor-form-section">
            <h2>Autores</h2>
            <p>Responsável pela publicação: <strong>{user.name}</strong> · {user.cohort}. Adicione colegas da mesma turma que participaram do projeto.</p>
            <CoauthorPicker people={people} ownerId={user.id} selected={coauthorIds} onChange={setCoauthorIds}/>
          </section>
          <section className="editor-form-section">
            <h2>Capa</h2>
            <p>Escolha uma capa pronta ou envie uma imagem.</p>
            <span className="form-label" id="cover-styles-label">Estilo da capa</span>
            <div className="cover-style-options" role="group" aria-labelledby="cover-styles-label">
              {COVER_STYLES.map((style, index) => <button key={style} type="button" className={`cover-style-option ${coverStyle === style && !imageUrl ? "selected" : ""}`} style={{ background: styles[index].color, color: styles[index].ink }} aria-label={`Capa ${styles[index].name}`} aria-pressed={coverStyle === style && !imageUrl} title={styles[index].name} onClick={() => { setCoverStyle(style); setImageUrl(""); if (fileRef.current) fileRef.current.value = ""; }}>{coverStyle === style && !imageUrl && <Icon name="check" size={16}/>}</button>)}
            </div>
            <label className="upload-cover">
              <Icon name={uploading ? "loader" : "upload"} className={uploading ? "spinner" : ""} size={23}/>
              <span>{uploading ? "Preparando imagem..." : imageUrl ? "Trocar imagem" : "Enviar imagem"}<small>JPG, PNG ou WebP · Até 2 MB · Formato horizontal</small></span>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={pending || uploading} aria-label="Enviar imagem de capa"/>
            </label>
            <div className="form-field" style={{ marginTop: 16, marginBottom: 0 }}>
              <label htmlFor="project-image-url">Endereço da imagem (opcional)</label>
              <input id="project-image-url" type="url" value={imageUrl.startsWith("data:") ? "" : imageUrl} onChange={event => setImageUrl(event.target.value)} placeholder="https://exemplo.com/minha-capa.jpg"/>
            </div>
            {imageUrl && <button type="button" className="remove-image" onClick={() => { setImageUrl(""); if (fileRef.current) fileRef.current.value = ""; }}><Icon name="x" size={13}/>Remover imagem e usar capa padrão</button>}
          </section>
          <section className="editor-form-section">
            <h2>Links</h2>
            <div className="form-field">
              <label htmlFor="project-github">Repositório no GitHub (opcional)</label>
              <input id="project-github" type="url" value={githubUrl} onChange={event => setGithubUrl(event.target.value)} placeholder="https://github.com/seu-usuario/seu-projeto" maxLength={2000}/>
            </div>
            <div className="form-field">
              <label htmlFor="project-live">Projeto online (opcional)</label>
              <input id="project-live" type="url" value={liveUrl} onChange={event => setLiveUrl(event.target.value)} placeholder="https://meu-projeto.vercel.app" maxLength={2000}/>
            </div>
          </section>
          {error && <div ref={errorRef} className="form-error" role="alert"><Icon name="x" size={16}/>{error}</div>}
          <div className="editor-submit">
            <Link href="/meus-projetos" className="button button-outline" aria-disabled={pending} onClick={event => { if (pending) event.preventDefault(); }}>Cancelar</Link>
            <button className="button button-dark" type="submit" disabled={pending || uploading}>{pending ? <><Icon name="loader" size={17} className="spinner"/>Salvando...</> : <>{project ? "Salvar alterações" : "Publicar projeto"}<Icon name="arrow-up-right" size={17}/></>}</button>
          </div>
        </fieldset>
      </form>
      <aside className="editor-preview">
        <span className="preview-eyebrow"><Icon name="eye" size={14}/>Prévia</span>
        <ProjectCover title={title || "Nome do projeto"} style={coverStyle} imageUrl={imageUrl}/>
        <h2 className="preview-title">{title || "Nome do projeto"}</h2>
        <div className="preview-author"><Avatar person={user} size={24}/><span>{user.name} · {user.cohort}</span></div>
        {technologies.length > 0 && <div className="technology-tags">{technologies.slice(0, 4).map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}{technologies.length > 4 && <span className="technology-tag">+{technologies.length - 4}</span>}</div>}
      </aside>
    </div>
  </main>;
}
