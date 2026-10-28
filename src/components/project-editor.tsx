"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COVER_STYLES, TECHNOLOGIES, type Person, type Project, type PublicationTurma } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";
import { CoverFramingEditor } from "./cover-framing-editor";
import type { CoverFraming } from "@/lib/cover-framing";
import { CoauthorPicker } from "./coauthor-picker";
import { validateImageFile } from "@/lib/image-policy";

const styles = [
  { name: "Tipografia", color: "#f2e6d2", ink: "#17130f" },
  { name: "Blocos", color: "#d9f24b", ink: "#17130f" },
  { name: "Grade", color: "#7dd3fc", ink: "#17130f" },
  { name: "Arcos", color: "#26308f", ink: "#fffdf6" },
  { name: "Raios", color: "#17150f", ink: "#fffdf6" },
  { name: "Duo", color: "#ff7a4d", ink: "#17130f" },
  { name: "Código", color: "#1d1b26", ink: "#fffdf6" },
];
export function ProjectEditor({ user, project, people, turmas = [] }: { user: Person; project?: Project; people: Person[]; turmas?: PublicationTurma[] }) {
  const router = useRouter();
  const notify = useToast();
  const [title, setTitle] = useState(project?.title || "");
  const [description, setDescription] = useState(project?.description || "");
  const [technologies, setTechnologies] = useState<string[]>(project?.technologies || []);
  const [isFinal, setIsFinal] = useState(project?.isFinal ?? false);
  const [coauthorIds, setCoauthorIds] = useState<string[]>(project?.authors.filter(author => author.id !== user.id).map(author => author.id) || []);
  const [turmaId, setTurmaId] = useState(project?.turmaId || turmas[0]?.id || "");
  const selectedTurma = turmas.find(turma => turma.id === turmaId);
  const turmaLabel = selectedTurma ? [selectedTurma.name, selectedTurma.courseName].filter(Boolean).join(" · ") : project?.author.cohort || "Sem turma";
  const [coverStyle, setCoverStyle] = useState(project?.coverStyle || "abstract");
  const [imageUrl, setImageUrl] = useState(project?.imageUrl || "");
  const [coverFraming, setCoverFraming] = useState<CoverFraming | null>(project?.coverFraming || null);
  const [githubUrl, setGithubUrl] = useState(project?.githubUrl || "");
  const [liveUrl, setLiveUrl] = useState(project?.liveUrl || "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => { if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  function changeImage(value: string) { setImageFile(null); setImageUrl(value); setCoverFraming(null); }
  function changeTurma(value: string) {
    if (value === turmaId) return;
    setTurmaId(value); setCoauthorIds([]);
    if (coauthorIds.length) notify("Turma alterada. Selecione novamente os coautores.");
  }
  function toggleTech(tech: string) {
    if (technologies.includes(tech)) setTechnologies(technologies.filter(value => value !== tech));
    else if (technologies.length < 8) setTechnologies([...technologies, tech]);
    else notify("Selecione no máximo 8 tecnologias.", true);
  }
  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      validateImageFile(file);
      setImageFile(file); setImageUrl(URL.createObjectURL(file)); setCoverFraming(null);
      notify("Imagem adicionada à prévia. Salve o projeto para enviar.");
    } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível preparar a imagem.", true); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!technologies.length) { setError("Selecione pelo menos uma tecnologia usada no projeto."); setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30); return; }
    setPending(true);
    try {
      const form = new FormData();
      form.set("data", JSON.stringify({ title, description, technologies, isFinal, turmaId, coauthorIds, coverStyle, imageUrl: imageFile ? "" : imageUrl, coverFraming, githubUrl, liveUrl }));
      if (imageFile) form.set("image", imageFile);
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", { method: project ? "PATCH" : "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar seu projeto.");
      notify(project ? "Projeto atualizado." : "Projeto publicado.");
      router.push(project?.visibility === "hidden" ? `/meus-projetos/${project.id}` : `/projetos/${data.slug}`); router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Confira sua conexão e tente novamente."); setPending(false); setTimeout(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 30); }
  }
  return <main id="conteudo" className="container inner-page">
    <Link href="/meus-projetos" className="back-link"><Icon name="arrow-left" size={16}/>Meus projetos</Link>
    <div className="editor-heading"><h1>{project ? "Editar projeto" : "Publicar projeto"}</h1></div>
    {project?.visibility === "hidden" && <div className="admin-notice project-moderation-note"><strong>Oculto pela administração</strong><p>{project.moderationReason}</p><p>Você pode editar o projeto. A publicação só poderá ser restaurada pela administração.</p></div>}
    <div className="editor-layout">
      <form className="editor-form" onSubmit={submit}>
        <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="editor-form-section" aria-label="Informações do projeto">
            <div className="form-field">
              <div className="field-label-row"><label htmlFor="project-title">Nome do projeto <span className="required-dot">*</span></label><span>{title.length}/80</span></div>
              <input id="project-title" value={title} onChange={event => setTitle(event.target.value)} required minLength={3} maxLength={80}/>
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
            <p>Responsável pela publicação: <strong>{user.name}</strong>. Adicione colegas da mesma turma que participaram do projeto.</p>
            <div className="form-field">
              <label htmlFor="project-turma">Turma</label>
              {!project && turmas.length > 1 ? <select id="project-turma" value={turmaId} onChange={event => changeTurma(event.target.value)}>
                {turmas.map(turma => <option key={turma.id} value={turma.id}>{[turma.name, turma.courseName].filter(Boolean).join(" · ")}</option>)}
              </select> : <output id="project-turma" className="project-turma-value">{turmaLabel}</output>}
              {!project && !turmas.length && <small>Peça à administração para associar sua conta a uma turma antes de publicar.</small>}
            </div>
            <CoauthorPicker key={turmaId} people={people.filter(person => person.turmaId === turmaId)} ownerId={user.id} selected={coauthorIds} onChange={setCoauthorIds} selectedPeople={project?.authors}/>
          </section>
          <section className="editor-form-section">
            <h2>Capa</h2>
            <p>Escolha uma capa pronta ou envie uma imagem.</p>
            <span className="form-label" id="cover-styles-label">Estilo da capa</span>
            <div className="cover-style-options" role="group" aria-labelledby="cover-styles-label">
              {COVER_STYLES.map((style, index) => <button key={style} type="button" className={`cover-style-option ${coverStyle === style && !imageUrl ? "selected" : ""}`} style={{ background: styles[index].color, color: styles[index].ink }} aria-label={`Capa ${styles[index].name}`} aria-pressed={coverStyle === style && !imageUrl} title={styles[index].name} onClick={() => { setCoverStyle(style); changeImage(""); if (fileRef.current) fileRef.current.value = ""; }}>{coverStyle === style && !imageUrl && <Icon name="check" size={16}/>}</button>)}
            </div>
            <label className="upload-cover">
              <Icon name="upload" size={23}/>
              <span>{imageUrl ? "Trocar imagem" : "Enviar imagem (opcional)"}<small>JPG, PNG ou WebP · Até 3 MB · Recomendado: horizontal 7:5</small></span>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFile} disabled={pending} aria-label="Enviar imagem de capa"/>
            </label>
            {imageUrl && <button type="button" className="remove-image" onClick={() => { changeImage(""); if (fileRef.current) fileRef.current.value = ""; }}><Icon name="x" size={13}/>Remover imagem e usar capa padrão</button>}
          </section>
          <section className="editor-form-section">
            <h2>Links</h2>
            <div className="form-field">
              <label htmlFor="project-github">Repositório no GitHub <span className="required-dot">*</span></label>
              <input id="project-github" type="url" required value={githubUrl} onChange={event => setGithubUrl(event.target.value)} placeholder="https://github.com/seu-usuario/seu-projeto" maxLength={2000}/>
            </div>
            <div className="form-field">
              <label htmlFor="project-live">Projeto online (opcional)</label>
              <input id="project-live" type="url" value={liveUrl} onChange={event => setLiveUrl(event.target.value)} placeholder="https://meu-projeto.vercel.app" maxLength={2000}/>
            </div>
          </section>
          {error && <div ref={errorRef} className="form-error" role="alert"><Icon name="x" size={16}/>{error}</div>}
          <div className="editor-submit">
            <Link href="/meus-projetos" className="button button-outline" aria-disabled={pending} onClick={event => { if (pending) event.preventDefault(); }}>Cancelar</Link>
            <button className="button button-dark" type="submit" disabled={pending || (!project && !turmaId)}>{pending ? <><Icon name="loader" size={17} className="spinner"/>Salvando...</> : <>{project ? "Salvar alterações" : "Publicar projeto"}<Icon name="arrow-up-right" size={17}/></>}</button>
          </div>
        </fieldset>
      </form>
      <aside className="editor-preview">
        <span className="preview-eyebrow"><Icon name="eye" size={14}/>Prévia</span>
        <CoverFramingEditor key={imageUrl || "poster"} title={title || "Nome do projeto"} style={coverStyle} imageUrl={imageUrl} isFinal={isFinal} value={coverFraming} onChange={setCoverFraming} disabled={pending}/>
        <div className="preview-author"><Avatar person={user} size={24}/><span className="author-name">{user.name}</span></div>
        {technologies.length > 0 && <div className="technology-tags">{technologies.slice(0, 4).map(tech => <span className="technology-tag" key={tech}>{tech}</span>)}{technologies.length > 4 && <span className="technology-tag">+{technologies.length - 4}</span>}</div>}
      </aside>
    </div>
  </main>;
}
