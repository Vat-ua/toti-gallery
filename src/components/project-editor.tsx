"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { COVER_STYLES, TECHNOLOGIES, type Person, type Project, type PublicationTurma } from "@/lib/types";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";
import { CoverFramingEditor } from "./cover-framing-editor";
import { DescriptionEditor } from "./description-editor";
import type { CoverFraming } from "@/lib/cover-framing";
import { CoauthorPicker } from "./coauthor-picker";
import { ImageActions } from "./image-actions";
import { FieldError, useFormFeedback } from "./form-feedback";
import { validateProject } from "@/lib/validation";
import { FormValidationError } from "@/lib/form-validation";
import { validateImageFile } from "@/lib/image-policy";
import { createProject, updateProject, CreationConflictError, type ProjectFormValues } from "@/lib/projects-client";
import { HttpError } from "@/lib/http-client";
import { creationAttempt, finishCreationAttempt } from "@/lib/project-creation-attempt";
import { useUnsavedChanges } from "./use-unsaved-changes";

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
  const [descriptionPreview, setDescriptionPreview] = useState(false);
  const [technologies, setTechnologies] = useState<string[]>(project?.technologies || []);
  const [isFinal, setIsFinal] = useState(project?.isFinal ?? false);
  const [coauthorIds, setCoauthorIds] = useState<string[]>(project?.authors.filter(author => author.id !== user.id).map(author => author.id) || []);
  const [turmaId, setTurmaId] = useState(project?.turmaId || turmas[0]?.id || "");
  const selectedTurma = turmas.find(turma => turma.id === turmaId);
  const coauthorTurmaName = project?.author.cohort || selectedTurma?.name;
  const [coverStyle, setCoverStyle] = useState(project?.coverStyle || "abstract");
  const [imageUrl, setImageUrl] = useState(project?.imageUrl || "");
  const [coverFraming, setCoverFraming] = useState<CoverFraming | null>(project?.coverFraming || null);
  const [githubUrl, setGithubUrl] = useState(project?.githubUrl || "");
  const [liveUrl, setLiveUrl] = useState(project?.liveUrl || "");
  const [pending, setPending] = useState(false);
  // Keep the version that populated this form, even if router.refresh updates props.
  const [expectedVersion] = useState(project?.version ?? 0);
  const feedback = useFormFeedback();
  const { fields, error } = feedback;
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [conflictLink, setConflictLink] = useState("");
  const requestId = useRef("");
  const submitting = useRef(false);
  const value: ProjectFormValues = { title, description, technologies, isFinal, turmaId, coauthorIds, coverStyle, imageUrl: imageFile ? "" : imageUrl, coverFraming, githubUrl, liveUrl };
  const [initial] = useState(() => JSON.stringify(value));
  const { markSaved } = useUnsavedChanges(!!imageFile || JSON.stringify(value) !== initial);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (imageUrl.startsWith("blob:")) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  function changeImage(value: string) { feedback.clear("imageUrl"); feedback.clear("coverFraming"); setImageFile(null); setImageUrl(value); setCoverFraming(null); }
  function changeTurma(value: string) {
    feedback.clear("turmaId"); feedback.clear("coauthorIds");
    if (value === turmaId) return;
    setTurmaId(value); setCoauthorIds([]);
    if (coauthorIds.length) notify("Turma alterada. Selecione novamente os coautores.");
  }
  function toggleTech(tech: string) {
    feedback.clear("technologies");
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
      feedback.clear("imageUrl"); feedback.clear("coverFraming");
      setImageFile(file); setImageUrl(URL.createObjectURL(file)); setCoverFraming(null);
      notify("Imagem adicionada à prévia. Salve o projeto para enviar.");
    } catch (error) {
      feedback.report(new FormValidationError({ imageUrl: error instanceof Error ? error.message : "Não foi possível preparar a imagem." }));
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (submitting.current) return;
    setDescriptionPreview(false);
    if (!feedback.validate(() => validateProject(value, project?.imageUrl), formElement)) return;
    submitting.current = true;
    setPending(true);
    try {
      if (!project && !requestId.current) requestId.current = creationAttempt(user.id, crypto.randomUUID());
      const data = project ? await updateProject(project.id, value, expectedVersion, imageFile) : await createProject(value, requestId.current, imageFile);
      if (!project) finishCreationAttempt(user.id, requestId.current);
      markSaved();
      notify(project ? "Projeto atualizado." : "Projeto publicado.");
      router.push(project?.visibility === "hidden" ? `/meus-projetos/${project.id}` : `/projetos/${data.slug}`); router.refresh();
    } catch (err) {
      if (err instanceof CreationConflictError) {
        // This receipt is confirmed. Keep this form bound to it, but let a fresh
        // publication form start a new attempt instead of inheriting a stale key.
        finishCreationAttempt(user.id, requestId.current);
        setConflictLink(`/meus-projetos/${encodeURIComponent(err.projectId)}`);
      }
      else if (!project && err instanceof HttpError && err.status === 410) finishCreationAttempt(user.id, requestId.current);
      else if (project && err instanceof HttpError && err.status === 409) setConflictLink(`/meus-projetos/${encodeURIComponent(project.id)}`);
      setDescriptionPreview(false); feedback.report(err, formElement); setPending(false); submitting.current = false;
    }
  }
  return <main id="conteudo" className="container inner-page">
    <Link href="/meus-projetos" className="back-link"><Icon name="arrow-left" size={16}/>Meus projetos</Link>
    <div className="editor-heading"><h1>{project ? "Editar projeto" : "Publicar projeto"}</h1></div>
    {project?.visibility === "hidden" && <div className="admin-notice project-moderation-note"><strong>Oculto pela administração</strong><p>{project.moderationReason}</p><p>Você pode editar o projeto. A publicação só poderá ser restaurada pela administração.</p></div>}
    <div className="editor-layout">
      <form className="editor-form" onSubmit={submit} noValidate aria-busy={pending}>
        <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <section className="editor-form-section" aria-label="Informações do projeto">
            <div className="form-field">
              <div className="field-label-row"><label htmlFor="project-title">Nome do projeto <span className="required-dot">*</span></label><span>{title.length}/80</span></div>
              <input id="project-title" name="title" aria-invalid={!!fields.title} aria-describedby={fields.title ? "project-title-error" : undefined} value={title} onChange={event => { setTitle(event.target.value); feedback.clear("title"); }} required minLength={3} maxLength={80}/><FieldError id="project-title-error" text={fields.title}/>
            </div>
            <DescriptionEditor value={description} onChange={value => { setDescription(value); feedback.clear("description"); }} error={fields.description} preview={descriptionPreview} onPreviewChange={setDescriptionPreview}/>
            <label className="checkbox-field" htmlFor="project-is-final"><input name="isFinal" id="project-is-final" type="checkbox" checked={isFinal} onChange={event => setIsFinal(event.target.checked)}/><span>Projeto final de curso</span></label>
          </section>
          <section className="editor-form-section">
            <h2 id="technologies-label">Tecnologias <span className="required-dot">*</span></h2>
            <div className="editor-technology-options" data-field="technologies" aria-describedby={fields.technologies ? "project-technologies-error" : undefined} role="group" aria-labelledby="technologies-label">
              {TECHNOLOGIES.map(tech => <button key={tech} type="button" className={`technology-option ${technologies.includes(tech) ? "selected" : ""}`} aria-pressed={technologies.includes(tech)} onClick={() => toggleTech(tech)}>{technologies.includes(tech) && <Icon name="check" size={12}/>} {tech}</button>)}
            </div>
          </section>
          <FieldError id="project-technologies-error" text={fields.technologies}/>
          <section className="editor-form-section">
            <h2>Autores</h2>
            <p>Responsável pela publicação: <strong>{user.name}</strong>. Adicione colegas da mesma turma que participaram do projeto.</p>
            {!project && turmas.length > 1 && <div className="form-field">
              <label htmlFor="project-turma">Turma</label>
              <select name="turmaId" id="project-turma" value={turmaId} aria-invalid={!!fields.turmaId} aria-describedby={fields.turmaId ? "project-turma-error" : undefined} onChange={event => changeTurma(event.target.value)}>
                {turmas.map(turma => <option key={turma.id} value={turma.id}>{[turma.name, turma.courseName].filter(Boolean).join(" · ")}</option>)}
              </select>
              <FieldError id="project-turma-error" text={fields.turmaId}/>
            </div>}
            {(project || turmas.length <= 1) && (fields.turmaId || (!project && !turmas.length)) && <div className="form-field" data-field="turmaId" tabIndex={-1} aria-describedby={fields.turmaId ? "project-turma-error" : undefined}>
              <FieldError id="project-turma-error" text={fields.turmaId}/>
              {!project && !turmas.length && !fields.turmaId && <small>Peça à administração para associar sua conta a uma turma antes de publicar.</small>}
            </div>}
            <CoauthorPicker key={turmaId} people={people.filter(person => person.turmaId === turmaId)} ownerId={user.id} selected={coauthorIds} onChange={ids => { setCoauthorIds(ids); feedback.clear("coauthorIds"); }} selectedPeople={project?.authors} error={fields.coauthorIds} turmaName={coauthorTurmaName}/>
          </section>
          <section className="editor-form-section">
            <h2>Capa</h2>
            <p>Escolha uma capa pronta ou envie sua própria imagem. Confira o resultado na prévia.</p>
            <span className="form-label" id="cover-styles-label">Capas prontas</span>
            <div className="cover-style-options" role="group" aria-labelledby="cover-styles-label">
              {COVER_STYLES.map((style, index) => <button key={style} type="button" className={`cover-style-option ${coverStyle === style && !imageUrl ? "selected" : ""}`} style={{ background: styles[index].color, color: styles[index].ink }} aria-label={`Capa ${styles[index].name}`} aria-pressed={coverStyle === style && !imageUrl} title={styles[index].name} onClick={() => { setCoverStyle(style); changeImage(""); if (fileRef.current) fileRef.current.value = ""; }}>{coverStyle === style && !imageUrl && <Icon name="check" size={16}/>}</button>)}
            </div>
            <div className="cover-image-controls" data-field="imageUrl">
              <label className="form-label" htmlFor="project-cover-file">Imagem própria (opcional)</label>
              {imageUrl ? <>
                <ImageActions changeLabel="Alterar imagem" hasImage removeLabel="Remover imagem" disabled={pending} describedBy={`cover-image-help${fields.imageUrl ? " project-image-error" : ""}`} onChange={() => fileRef.current?.click()} onRemove={() => { changeImage(""); if (fileRef.current) fileRef.current.value = ""; }}/>
                <small id="cover-image-help">JPG, PNG ou WebP · Até 3 MB · Recomendado: horizontal 7:5</small>
              </> : <label className="upload-cover" htmlFor="project-cover-file">
                <Icon name="upload" size={23}/>
                <span>Enviar imagem<small>JPG, PNG ou WebP · Até 3 MB · Recomendado: horizontal 7:5</small></span>
              </label>}
              <input ref={fileRef} id="project-cover-file" type="file" accept="image/jpeg,image/png,image/webp" hidden={!!imageUrl} onChange={handleFile} disabled={pending} aria-label="Enviar imagem de capa" aria-invalid={!!fields.imageUrl} aria-describedby={fields.imageUrl ? "project-image-error" : undefined}/>
            </div>
            <FieldError id="project-image-error" text={fields.imageUrl}/>
          </section>
          <section className="editor-form-section">
            <h2>Links</h2>
            <div className="form-field">
              <label htmlFor="project-github">Repositório no GitHub <span className="required-dot">*</span></label>
              <input name="githubUrl" aria-invalid={!!fields.githubUrl} aria-describedby={fields.githubUrl ? "project-github-error" : undefined} id="project-github" type="url" required value={githubUrl} onChange={event => { setGithubUrl(event.target.value); feedback.clear("githubUrl"); }} placeholder="https://github.com/seu-usuario/seu-projeto" maxLength={2000}/><FieldError id="project-github-error" text={fields.githubUrl}/>
            </div>
            <div className="form-field">
              <label htmlFor="project-live">Projeto online (opcional)</label>
              <input name="liveUrl" aria-invalid={!!fields.liveUrl} aria-describedby={fields.liveUrl ? "project-live-error" : undefined} id="project-live" type="url" value={liveUrl} onChange={event => { setLiveUrl(event.target.value); feedback.clear("liveUrl"); }} placeholder="https://meu-projeto.vercel.app" maxLength={2000}/><FieldError id="project-live-error" text={fields.liveUrl}/>
            </div>
          </section>
          {(error || fields.coverFraming) && <div className="form-error" role="alert"><Icon name="x" size={16}/>{error || fields.coverFraming}</div>}
          {conflictLink && <p><Link className="editor-conflict-link" href={conflictLink} target="_blank" rel="noopener noreferrer">Conferir projeto salvo <Icon name="arrow-up-right" size={16}/></Link></p>}
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
