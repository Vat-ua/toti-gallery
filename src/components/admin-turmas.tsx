"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { AdminStudent, AdminTurma, ImportPreview, TurmaProject, StudentLookup, StudentAdded } from "@/lib/admin-types";
import { Icon } from "./icon";
import { accessMessage, formatAccessExpiry } from "@/lib/access-message";
import { Avatar, useToast } from "./ui";

async function request(path: string, body: unknown, method = "POST", signal?: AbortSignal) {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Não foi possível salvar. Tente novamente.");
  return data;
}
const message = (error: unknown) => error instanceof Error ? error.message : "Confira sua conexão e tente novamente.";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const statusText = { pending: "Pendente", active: "Ativo", suspended: "Suspenso" };

function Dialog({ title, context, description, children, close, busy = false, drawer = false }: { title: string; context?: string; description?: string; children: ReactNode; close: () => void; busy?: boolean; drawer?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => { const dialog = ref.current!; const previous = document.body.style.overflow; document.body.style.overflow = "hidden"; dialog.showModal(); return () => { dialog.close(); document.body.style.overflow = previous; }; }, []);
  return createPortal(<dialog ref={ref} className={`admin-dialog ${drawer ? "admin-drawer" : ""}`} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy) close(); }} onClick={event => {
    if (event.target !== event.currentTarget || busy) return;
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close();
  }}>
    <div className="admin-dialog-heading"><div>{context && <p className="admin-dialog-context">{context}</p>}<h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="admin-icon-button" onClick={close} disabled={busy} aria-label="Fechar"><Icon name="x"/></button></div>
    {children}
  </dialog>, document.body);
}
function ErrorText({ text }: { text: string }) { return text ? <p className="form-error" role="alert">{text}</p> : null; }
function Empty({ title, text }: { title: string; text: string }) { return <div className="admin-empty"><Icon name="users" size={30}/><h3>{title}</h3><p>{text}</p></div>; }
function Search({ value, change, placeholder }: { value: string; change: (value: string) => void; placeholder: string }) {
  return <div className="search-field admin-search"><Icon name="search" size={19}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => change(e.target.value)}/>{value && <button type="button" onClick={() => change("")} aria-label="Limpar busca"><Icon name="x" size={17}/></button>}</div>;
}
function TurmaForm({ turma, close, saved }: { turma?: Pick<AdminTurma, "id" | "name" | "number" | "courseName" | "startYear" | "archived">; close: () => void; saved: (id: string, text?: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirmArchive, setConfirmArchive] = useState(false), [archiveError, setArchiveError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget); setBusy(true); setError("");
    const value = { number: Number(fields.get("number")), courseName: String(fields.get("course")), startYear: Number(fields.get("year")) };
    try { const data = await request(turma ? `/api/admin/turmas/${turma.id}` : "/api/admin/turmas", turma ? { action: "save", ...value } : value, turma ? "PATCH" : "POST"); saved(data.id); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function archive() {
    if (!turma) return;
    setBusy(true); setArchiveError("");
    try { await request(`/api/admin/turmas/${turma.id}`, { action: "archive", archived: !turma.archived }, "PATCH"); saved(turma.id, turma.archived ? "Turma desarquivada." : "Turma arquivada."); }
    catch (error) { setArchiveError(message(error)); } finally { setBusy(false); }
  }
  return <Dialog title={turma ? "Editar turma" : "Nova turma"} description={turma ? undefined : "Informe o curso e o ano de início desta turma."} close={close} busy={busy} drawer><form onSubmit={submit}><fieldset disabled={busy || confirmArchive} className="account-fieldset">
    <div className="form-field"><label htmlFor="turma-number">Número da turma</label><input id="turma-number" name="number" type="number" required min={1} max={999999999} defaultValue={turma?.number} placeholder="26" autoFocus/></div>
    <div className="form-field"><label htmlFor="turma-course">Nome do curso</label><input id="turma-course" name="course" required minLength={2} maxLength={100} defaultValue={turma?.courseName || ""} placeholder="Full Stack"/></div>
    <div className="form-field"><label htmlFor="turma-year">Ano de início</label><input id="turma-year" name="year" type="number" required min={2000} max={2100} defaultValue={turma?.startYear || ""} placeholder="2026"/></div>
    <ErrorText text={error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" onClick={close}>Cancelar</button><button className="button button-dark" type="submit">{busy ? "Salvando..." : turma ? "Salvar alterações" : "Criar turma"}</button></div>
  </fieldset></form>{turma && <section className="admin-turma-archive">
    <h3>{confirmArchive ? `${turma.archived ? "Desarquivar" : "Arquivar"} ${turma.name}?` : "Situação da turma"}</h3>
    <p>{turma.archived ? "A turma está arquivada. Desarquivar faz com que ela volte à lista de ativas." : "Arquivar organiza a lista de turmas. Estudantes continuam com acesso e podem publicar projetos."}</p>
    {confirmArchive ? <><p>Esta ação não salva alterações nos campos acima.</p><ErrorText text={archiveError}/><div className="admin-inline-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setConfirmArchive(false)}>Voltar à edição</button><button type="button" className="button button-dark" disabled={busy} onClick={archive}>{busy ? "Salvando..." : turma.archived ? "Desarquivar turma" : "Arquivar turma"}</button></div></> : <button type="button" className="button button-outline" disabled={busy} onClick={() => { setArchiveError(""); setConfirmArchive(true); }}>{turma.archived ? "Desarquivar turma" : "Arquivar turma"}</button>}
  </section>}</Dialog>;
}

export function TurmasList({ turmas }: { turmas: AdminTurma[] }) {
  const router = useRouter(), notify = useToast();
  const [query, setQuery] = useState(""), [state, setState] = useState("active"), [create, setCreate] = useState(false);
  const [editing, setEditing] = useState<AdminTurma | null>(null);
  const rows = turmas.filter(t => normalize(`${t.name} ${t.courseName || ""} ${t.startYear || ""}`).includes(normalize(query)) && (state === "all" || t.archived === (state === "archived")))
    .sort((a,b) => Number(a.archived) - Number(b.archived) || b.name.localeCompare(a.name, "pt-BR", { numeric: true }));
  return <>
    <div className="admin-heading"><div><h1>Turmas</h1><p>Organize grupos, estudantes e projetos.</p></div><button type="button" className="button button-dark" onClick={() => setCreate(true)}><Icon name="plus" size={18}/>Nova turma</button></div>
    <div className="admin-toolbar"><Search value={query} change={setQuery} placeholder="Buscar turma"/><div className="admin-segments" aria-label="Situação da turma">{[["active", "Ativas"], ["archived", "Arquivadas"], ["all", "Todas"]].map(([value,label]) => <button type="button" aria-pressed={state === value} key={value} onClick={() => setState(value)}>{label}</button>)}</div><p className="results-count"><strong>{rows.length}</strong> {rows.length === 1 ? "turma" : "turmas"}</p></div>
    <div className="admin-list">{rows.length ? <table className="admin-table turma-table"><thead><tr><th scope="col">Turma</th><th scope="col">Ano</th><th scope="col">Estudantes</th><th scope="col">Projetos</th><th scope="col">Ações</th></tr></thead><tbody>{rows.map(t => <tr key={t.id}><td><Link className="admin-row-title" href={`/admin/turmas/${t.id}`}><strong>{t.name}</strong></Link>{t.courseName && <small>{t.courseName}</small>}{t.archived && <span className="admin-badge is-muted">Arquivada</span>}</td><td data-label="Ano">{t.startYear || "—"}</td><td data-label="Estudantes">{t.students}</td><td data-label="Projetos">{t.projects}</td><td><div className="admin-row-actions"><Link href={`/admin/turmas/${t.id}`} className="button button-outline admin-small-button"><Icon name="users" size={16}/>Gerenciar</Link><button type="button" className="button button-outline admin-small-button" onClick={() => setEditing(t)} aria-label={`Editar ${t.name}`}><Icon name="edit" size={16}/>Editar</button></div></td></tr>)}</tbody></table> : <Empty title={query || state !== "active" ? "Nenhuma turma encontrada" : "Sua primeira turma começa aqui"} text={query || state !== "active" ? "Ajuste a busca ou a situação selecionada." : "Crie uma turma para adicionar estudantes e organizar os projetos."}/>}</div>
    {editing && <TurmaForm turma={editing} close={() => setEditing(null)} saved={(_id, text) => { setEditing(null); notify(text || "Turma atualizada."); router.refresh(); }}/>}
    {create && <TurmaForm close={() => setCreate(false)} saved={id => { setCreate(false); notify("Turma criada."); router.push(`/admin/turmas/${id}`); router.refresh(); }}/>}
  </>;
}

type DetailProps = { turma: Pick<AdminTurma, "id" | "name" | "number" | "courseName" | "startYear" | "archived">; members: AdminStudent[]; candidates: AdminStudent[]; projects: TurmaProject[]; owner: boolean };
export function TurmaDetail({ turma, members, candidates, projects, owner }: DetailProps) {
  const router = useRouter(), notify = useToast();
  const [tab, setTab] = useState("students"), [query, setQuery] = useState(""), [status, setStatus] = useState("all");
  const [modal, setModal] = useState<"edit" | "archive" | "add" | "import" | null>(null), [selected, setSelected] = useState<AdminStudent | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const filtered = members.filter(m => normalize(m.name + " " + m.email).includes(normalize(query)) && (status === "all" || (!m.isDemo && m.status === status) || (status === "demo" && m.isDemo)));
  function refresh(text: string) { setModal(null); setSelected(null); notify(text); router.refresh(); }
  async function archive() {
    setBusy(true); setError("");
    try { await request(`/api/admin/turmas/${turma.id}`, { action: "archive", archived: !turma.archived }, "PATCH"); refresh(turma.archived ? "Turma desarquivada." : "Turma arquivada."); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <>
    <Link className="back-link admin-back" href="/admin/turmas"><Icon name="arrow-left" size={16}/>Turmas</Link>
    <div className="admin-heading"><div><div className="admin-title-line"><h1>{turma.name}</h1>{turma.archived && <span className="admin-badge is-muted">Arquivada</span>}</div><p>{members.length} {members.length === 1 ? "estudante" : "estudantes"} · {projects.length} {projects.length === 1 ? "projeto" : "projetos"}{turma.courseName && ` · ${turma.courseName}`}{turma.startYear && ` · ${turma.startYear}`}</p></div><div className="admin-heading-actions"><button type="button" className="button button-outline" onClick={() => setModal("edit")}><Icon name="edit" size={17}/>Editar turma</button><button type="button" className="button button-outline" onClick={() => { setError(""); setModal("archive"); }}>{turma.archived ? "Desarquivar" : "Arquivar"}</button></div></div>
    {turma.archived && <p className="admin-notice">Esta turma está arquivada. Seus participantes continuam com acesso e podem publicar projetos.</p>}
    <div className="admin-detail-tabs" role="group" aria-label="Conteúdo da turma"><button type="button" aria-pressed={tab === "students"} onClick={() => setTab("students")}>Estudantes <span>{members.length}</span></button><button type="button" aria-pressed={tab === "projects"} onClick={() => setTab("projects")}>Projetos <span>{projects.length}</span></button></div>
    {tab === "students" ? <>
      <div className="admin-toolbar"><Search value={query} change={setQuery} placeholder="Buscar por nome ou email"/><select className="admin-select" aria-label="Filtrar estudantes por acesso" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos os acessos</option><option value="pending">Pendentes</option><option value="active">Ativos</option><option value="suspended">Suspensos</option><option value="demo">Perfis de exemplo</option></select><div className="admin-toolbar-actions"><button type="button" className="button button-outline" onClick={() => setModal("import")}><Icon name="upload" size={17}/>Importar lista</button><button type="button" className="button button-dark" onClick={() => setModal("add")}><Icon name="plus" size={17}/>Adicionar estudante</button></div></div>
      <div className="admin-list">{filtered.length ? <table className="admin-table student-table"><thead><tr><th scope="col">Estudante</th><th scope="col">Outras turmas</th><th scope="col">Acesso</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>{filtered.map(person => <tr key={person.id}><td><div className="admin-person"><Avatar person={person} size={38}/><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td><td data-label="Outras turmas"><span className="admin-muted">{person.turmaNames.filter(n => n !== turma.name).join(", ") || "—"}</span></td><td><span className={`admin-badge ${person.isDemo ? "is-muted" : `is-${person.status}`}`}>{person.isDemo ? "Perfil de exemplo" : statusText[person.status]}</span></td><td className="admin-actions-cell"><button type="button" className="button button-outline admin-small-button" disabled={!owner && person.role !== "user"} onClick={() => setSelected(person)} aria-label={`Gerenciar ${person.name}`}><Icon name="user" size={16}/>Gerenciar</button></td></tr>)}</tbody></table> : <Empty title={members.length ? "Nenhum estudante encontrado" : "Adicione os primeiros estudantes"} text={members.length ? "Tente outro nome, email ou situação de acesso." : "Cadastre uma pessoa, adicione um perfil existente ou importe uma lista."}/>}</div>
    </> : <div className="admin-list admin-project-list">{projects.length ? <table className="admin-table"><thead><tr><th scope="col">Projeto</th><th scope="col">Publicação</th></tr></thead><tbody>{projects.map(project => <tr key={project.id}><td>{project.visibility === "published" ? <Link className="admin-row-link" href={`/projetos/${project.slug}`}><span><strong>{project.title}</strong><small>{project.author}</small></span><Icon name="arrow-up-right" size={17}/></Link> : <span className="admin-row-link"><span><strong>{project.title}</strong><small>{project.author}</small></span></span>}{project.isFinal && <span className="admin-project-final">Projeto final</span>}</td><td><span className={`admin-badge ${project.visibility === "hidden" ? "is-muted" : ""}`}>{project.visibility === "hidden" ? "Oculto" : "Publicado"}</span></td></tr>)}</tbody></table> : <Empty title="Ainda não há projetos" text="As publicações vinculadas a esta turma aparecerão aqui."/>}</div>}
    {modal === "edit" && <TurmaForm turma={turma} close={() => setModal(null)} saved={(_id, text) => refresh(text || "Turma atualizada.")}/>}
    {modal === "archive" && <Dialog context={turma.name} title={turma.archived ? "Desarquivar turma?" : "Arquivar turma?"} description={turma.archived ? "A turma voltará à lista de ativas." : "A turma irá para a lista de arquivadas. Estudantes, projetos e permissões de publicação serão mantidos."} close={() => setModal(null)} busy={busy}><ErrorText text={error}/><div className="admin-dialog-actions"><button className="button button-outline" onClick={() => setModal(null)} disabled={busy}>Cancelar</button><button className="button button-dark" onClick={archive} disabled={busy}>{busy ? "Salvando..." : turma.archived ? "Desarquivar turma" : "Arquivar turma"}</button></div></Dialog>}
    {modal === "add" && <AddStudent turmaId={turma.id} turmaName={turma.name} candidates={candidates} close={() => setModal(null)} saved={() => { notify("Estudante adicionado à turma."); router.refresh(); }}/>}
    {modal === "import" && <ImportStudents turmaId={turma.id} turmaName={turma.name} close={() => setModal(null)} saved={text => { notify(text); router.refresh(); }}/>}
    {selected && <ManageStudent turmaId={turma.id} turmaName={turma.name} student={selected} close={() => setSelected(null)} saved={() => refresh("Estudante removido desta turma. Perfil e autorias preservados.")}/>}
  </>;
}

type Grant = { url: string; expiresAt: string };
function AccessLinkBox({ grant, name, activation }: { grant: Grant; name: string; activation: boolean }) {
  const id = useId(), ref = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false), [error, setError] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(accessMessage(name, grant.url, grant.expiresAt, activation)); setCopied(true); setError(""); }
    catch { ref.current?.select(); setError("Selecione e copie o link manualmente."); }
  }
  return <div className="admin-generated-link"><label htmlFor={id}>Link pessoal</label><input id={id} ref={ref} readOnly value={grant.url} onFocus={e => e.target.select()}/><small>Válido até {formatAccessExpiry(grant.expiresAt)} (horário de Brasília). Exibido apenas agora; um novo link substitui o anterior.</small><button type="button" className="button button-dark" onClick={copy}><Icon name={copied ? "check" : "mail"} size={17}/>{copied ? "Mensagem copiada" : activation ? "Copiar mensagem de ativação" : "Copiar mensagem"}</button><ErrorText text={error}/></div>;
}

type StudentCandidate = Pick<AdminStudent, "id" | "name" | "email" | "status" | "isDemo">;
function AddStudent({ turmaId, turmaName, turmas, candidates, close, saved }: { turmaId?: string; turmaName?: string; turmas?: AdminTurma[]; candidates?: AdminStudent[]; close: () => void; saved: () => void }) {
  const [selectedTurma, setSelectedTurma] = useState("");
  const activeTurmaId = turmaId || selectedTurma;
  const activeTurmaName = turmaName || turmas?.find(t => t.id === activeTurmaId)?.name;
  const [mode, setMode] = useState("new"), [query, setQuery] = useState(""), [chosen, setChosen] = useState("");
  const [email, setEmail] = useState(""), [name, setName] = useState("");
  const [lookup, setLookup] = useState<{ email: string; student: StudentLookup | null } | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [added, setAdded] = useState<StudentAdded | null>(null), [grant, setGrant] = useState<Grant | null>(null);
  const [remoteCandidates, setRemoteCandidates] = useState<{ key: string; people: StudentCandidate[] } | null>(null);
  const [candidateError, setCandidateError] = useState(""), [candidateAttempt, setCandidateAttempt] = useState(0);
  const candidateKey = `${activeTurmaId}:${query}`;
  const filtered = candidates ? candidates.filter(p => !p.turmaIds.includes(activeTurmaId) && normalize(p.name + " " + p.email).includes(normalize(query))) : remoteCandidates?.key === candidateKey ? remoteCandidates.people : [];
  const checkingCandidates = mode === "existing" && !!activeTurmaId && !candidates && remoteCandidates?.key !== candidateKey && !candidateError;
  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const checking = mode === "new" && !!activeTurmaId && validEmail && lookup?.email !== normalizedEmail && !lookupError;
  const found = lookup?.email === normalizedEmail ? lookup.student : null;
  useEffect(() => {
    if (mode !== "new" || added || !validEmail || !activeTurmaId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await request(`/api/admin/turmas/${activeTurmaId}/members`, { action: "lookup", email: normalizedEmail }, "POST", controller.signal);
        if (!controller.signal.aborted) { setLookup({ email: normalizedEmail, student: result.student }); setLookupError(""); }
      } catch { if (!controller.signal.aborted) setLookupError("Não foi possível verificar o email. Altere-o ou tente novamente."); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, added, validEmail, normalizedEmail, activeTurmaId, lookupAttempt]);
  useEffect(() => {
    if (mode !== "existing" || candidates || added || !activeTurmaId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await request(`/api/admin/turmas/${activeTurmaId}/members`, { action: "candidates", query }, "POST", controller.signal);
        if (!controller.signal.aborted) { setRemoteCandidates({ key: candidateKey, people: result.candidates }); setCandidateError(""); }
      } catch { if (!controller.signal.aborted) setCandidateError("Não foi possível buscar os perfis. Tente novamente."); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, candidates, added, activeTurmaId, query, candidateKey, candidateAttempt]);
  async function generate(student: StudentAdded) {
    setBusy(true); setError("");
    try { setGrant(await request(`/api/admin/turmas/${activeTurmaId}/access`, { userId: student.id, purpose: "activation" })); }
    catch { setError("O estudante foi adicionado. Não foi possível criar o link; tente gerar novamente."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      let student: StudentAdded;
      if (mode === "existing") {
        const person = filtered.find(p => p.id === chosen);
        if (!person) throw new Error("Escolha uma pessoa.");
        await request(`/api/admin/turmas/${activeTurmaId}/members`, { userId: chosen });
        student = { ...person, created: false };
      } else {
        if (checking || lookupError || !validEmail || lookup?.email !== normalizedEmail || found?.member || found?.blocked) throw new Error("Confira o email e aguarde a verificação.");
        student = await request(`/api/admin/turmas/${activeTurmaId}/members`, { action: "add", name: found?.name || name, email: normalizedEmail });
      }
      setAdded(student); saved();
      if (student.created && student.status === "pending") await generate(student);
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  const canSubmit = !!activeTurmaId && (mode === "existing" ? !!chosen && !checkingCandidates && !candidateError : validEmail && !checking && !lookupError && lookup?.email === normalizedEmail && !found?.blocked && !found?.member);
  function reset() { setAdded(null); setGrant(null); setMode("new"); setEmail(""); setName(""); setLookup(null); setLookupError(""); setError(""); setChosen(""); setQuery(""); setRemoteCandidates(null); setCandidateError(""); }
  return <Dialog context={activeTurmaName} title={added ? "Estudante adicionado" : "Adicionar estudante"} description={added ? added.email : undefined} close={close} busy={busy} drawer>
    {added ? <div className="admin-add-success"><div className="admin-success-mark"><Icon name="check" size={24}/></div><h3>{added.name}</h3><p>{added.created ? "O perfil foi criado e adicionado à turma." : "O perfil existente foi adicionado à turma. Seus dados foram preservados."}</p>
      {added.status === "pending" && <><p>Envie a mensagem de ativação para o email cadastrado. O estudante poderá usar o Google ou criar uma senha.</p>{grant ? <AccessLinkBox grant={grant} name={added.name} activation/> : <button className="button button-outline" type="button" disabled={busy} onClick={() => generate(added)}>{busy ? "Preparando link..." : "Gerar link de ativação"}</button>}</>}
      <ErrorText text={error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" disabled={busy} onClick={reset}>Adicionar outro</button><button type="button" className="button button-dark" disabled={busy} onClick={close}>Concluir</button></div>
    </div> : <><div className="admin-mode-tabs"><button type="button" aria-pressed={mode === "new"} disabled={busy} onClick={() => { setMode("new"); setError(""); }}>Novo cadastro</button><button type="button" aria-pressed={mode === "existing"} disabled={busy} onClick={() => { setMode("existing"); setError(""); }}>Perfil existente</button></div><form onSubmit={submit}><fieldset className="account-fieldset" disabled={busy}>
      {!turmaId && <div className="form-field"><label htmlFor="add-student-turma">Turma</label><select id="add-student-turma" required value={selectedTurma} onChange={event => { setSelectedTurma(event.target.value); setLookup(null); setLookupError(""); setChosen(""); setError(""); setCandidateError(""); }}><option value="">Selecione uma turma</option>{turmas?.map(t => <option key={t.id} value={t.id}>{t.name}{t.courseName ? ` · ${t.courseName}` : ""}{t.archived ? " · Arquivada" : ""}</option>)}</select></div>}
      {mode === "new" ? <><div className="form-field"><label htmlFor="student-email">Email</label><input id="student-email" name="email" type="email" required maxLength={254} value={email} onChange={e => { setEmail(e.target.value); setLookup(null); setName(""); setLookupError(""); setError(""); }} autoComplete="off" autoFocus aria-describedby="student-lookup-status"/></div>
        <div id="student-lookup-status" className="admin-lookup-status" role="status">{checking ? "Verificando email..." : lookupError ? lookupError : found?.member ? "Já participa desta turma." : found?.blocked ? found.reason : found ? "Este perfil já existe. Você pode adicioná-lo à turma." : lookup?.email === normalizedEmail ? "Novo email. Informe o nome para criar o perfil." : ""}</div>
        {lookupError && <button type="button" className="button button-outline admin-small-button" onClick={() => { setLookupError(""); setLookupAttempt(n => n + 1); }}>Tentar novamente</button>}
        <div className="form-field"><label htmlFor="student-name">Nome completo</label><input id="student-name" name="name" required minLength={2} maxLength={70} value={found?.name || name} onChange={e => setName(e.target.value)} readOnly={!!found || checking} autoComplete="off"/></div>
      </> : <><Search value={query} change={value => { setQuery(value); setChosen(""); setCandidateError(""); }} placeholder="Buscar perfil cadastrado"/>{!candidates && activeTurmaId && <p className="admin-help">Até 25 perfis por busca. Procure por nome ou email.</p>}<div className="admin-candidates" role="group" aria-label="Perfis disponíveis" aria-busy={checkingCandidates}>{checkingCandidates ? <p className="admin-help" role="status">Buscando perfis...</p> : candidateError ? <><ErrorText text={candidateError}/><button type="button" className="button button-outline admin-small-button" onClick={() => { setCandidateError(""); setCandidateAttempt(n => n + 1); }}>Tentar novamente</button></> : filtered.length ? filtered.map(p => <label key={p.id} className="admin-candidate"><input type="radio" name="person" value={p.id} checked={chosen === p.id} onChange={() => setChosen(p.id)}/><span><strong>{p.name}</strong><small>{p.email}{p.isDemo ? " · Perfil de exemplo" : ""}</small></span></label>) : <p className="admin-help">{!activeTurmaId ? "Selecione uma turma para buscar perfis." : "Nenhum perfil disponível."}</p>}</div></>}
      <ErrorText text={error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" onClick={close}>Cancelar</button><button type="submit" className="button button-dark" disabled={!canSubmit}>{busy ? "Adicionando..." : mode === "new" && !found ? "Criar e adicionar" : "Adicionar à turma"}</button></div>
    </fieldset></form></>}
  </Dialog>;
}

function ImportStudents({ turmaId, turmaName, turmas, close, saved }: { turmaId?: string; turmaName?: string; turmas?: AdminTurma[]; close: () => void; saved: (text: string) => void }) {
  const [selectedTurma, setSelectedTurma] = useState("");
  const activeTurmaId = turmaId || selectedTurma;
  const activeTurmaName = turmaName || turmas?.find(t => t.id === activeTurmaId)?.name;
  const [text, setText] = useState(""), [rows, setRows] = useState<ImportPreview[] | null>(null), [excluded, setExcluded] = useState<number[]>([]);
  const [result, setResult] = useState<{ created: number; linked: number; unchanged: number } | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""); const file = useRef<HTMLInputElement>(null);
  const selected = rows?.filter(r => !excluded.includes(r.line)) || [];
  const invalid = selected.some(r => r.kind === "error");
  const fresh = selected.filter(r => r.kind === "new").length, linked = selected.filter(r => r.kind === "existing").length;
  const unchanged = selected.filter(r => r.kind === "member").length, errors = selected.filter(r => r.kind === "error").length;
  async function preview() {
    setBusy(true); setError("");
    try { const data = await request(`/api/admin/turmas/${activeTurmaId}/import`, { action: "preview", text }); setRows(data.preview); setExcluded([]); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true); setError("");
    try { const data = await request(`/api/admin/turmas/${activeTurmaId}/import`, { action: "confirm", text, excluded }); setResult(data); saved("Importação concluída."); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  function reset() { setResult(null); setRows(null); setExcluded([]); setText(""); setError(""); }
  return <Dialog context={activeTurmaName} title={result ? "Importação concluída" : "Importar estudantes"} description={result ? undefined : rows ? "Confira a lista antes de confirmar. Perfis existentes serão preservados." : "Cole as colunas Nome e Email de uma planilha ou escolha um arquivo CSV."} close={close} busy={busy} drawer>
    {result ? <div className="admin-import-result"><div className="admin-success-mark"><Icon name="check" size={24}/></div><dl><div><dt>Novos perfis</dt><dd>{result.created}</dd></div><div><dt>Participações adicionadas</dt><dd>{result.linked}</dd></div><div><dt>Já participavam da turma</dt><dd>{result.unchanged}</dd></div></dl><p>Os dados dos perfis existentes foram preservados.</p><div className="admin-dialog-actions"><button type="button" className="button button-outline" onClick={reset}>Importar outra lista</button><button type="button" className="button button-dark" onClick={close}>Concluir</button></div></div> : <>
    {!rows ? <>{!turmaId && <div className="form-field"><label htmlFor="import-student-turma">Turma</label><select id="import-student-turma" required disabled={busy} value={selectedTurma} onChange={event => { setSelectedTurma(event.target.value); setError(""); }}><option value="">Selecione uma turma</option>{turmas?.map(t => <option key={t.id} value={t.id}>{t.name}{t.courseName ? ` · ${t.courseName}` : ""}{t.archived ? " · Arquivada" : ""}</option>)}</select></div>}<div className="admin-import-source"><button type="button" className="button button-outline" onClick={() => file.current?.click()} disabled={busy}><Icon name="upload" size={17}/>Escolher CSV</button><span>Até 500 estudantes · 200 KB</span><input type="file" ref={file} accept=".csv,.tsv,text/csv,text/tab-separated-values" hidden onChange={async event => { const chosen = event.target.files?.[0]; event.target.value = ""; if (!chosen) return; if (chosen.size > 200_000) { setError("O arquivo deve ter até 200 KB."); return; } try { setText(await chosen.text()); setError(""); } catch { setError("Não foi possível ler o arquivo."); } }}/></div><div className="form-field"><label htmlFor="student-list">Lista de estudantes</label><textarea id="student-list" value={text} onChange={e => setText(e.target.value)} rows={9} maxLength={200_000} placeholder={'Nome,Email\nAna Silva,ana@gmail.com\nJoão Santos,joao@gmail.com'} spellCheck={false} disabled={busy}/></div></> : <>
      <div className="admin-import-summary">{fresh > 0 && <strong>{fresh} {fresh === 1 ? "novo perfil" : "novos perfis"}</strong>}{linked > 0 && <span>{linked} {linked === 1 ? "perfil" : "perfis"} para adicionar à turma</span>}{unchanged > 0 && <span>{unchanged} {unchanged === 1 ? "já participa" : "já participam"}</span>}{errors > 0 && <span>{errors} {errors === 1 ? "linha para revisar" : "linhas para revisar"}</span>}{!selected.length && <span>Nenhuma linha selecionada</span>}</div>
      <div className="admin-import-preview"><table className="admin-table"><thead><tr><th scope="col"><span className="sr-only">Incluir</span></th><th scope="col">Nome / email</th><th scope="col">Resultado</th></tr></thead><tbody>{rows.map(row => <tr key={row.line} className={excluded.includes(row.line) ? "is-excluded" : ""}><td><input type="checkbox" checked={!excluded.includes(row.line)} aria-label={`Incluir linha ${row.line}, ${row.name || row.email}`} disabled={busy} onChange={() => setExcluded(current => current.includes(row.line) ? current.filter(n => n !== row.line) : [...current, row.line])}/></td><td><strong>{row.name || "Sem nome"}</strong><small>{row.email || "Sem email"}</small></td><td><span className={`admin-badge ${row.kind === "error" ? "is-error" : row.kind === "member" ? "is-muted" : ""}`}>{({ new: "Novo perfil", existing: "Já cadastrado", member: "Já participa", error: "Revisar" })[row.kind]}</span>{row.error && <small className="admin-row-error">Linha {row.line}: {row.error}</small>}</td></tr>)}</tbody></table></div>
      {invalid && <p className="admin-help">Volte para corrigir a lista ou desmarque as linhas com erro.</p>}
    </>}
    <ErrorText text={error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" disabled={busy} onClick={rows ? () => { setRows(null); setError(""); } : close}>{rows ? "Voltar à lista" : "Cancelar"}</button><button type="button" className="button button-dark" disabled={busy || !activeTurmaId || (rows ? invalid || !selected.length : !text.trim())} onClick={rows ? confirm : preview}>{busy ? "Processando..." : rows ? "Confirmar importação" : "Revisar lista"}</button></div>
    </>}
  </Dialog>;
}

export { Dialog, ErrorText, Search, AccessLinkBox, AddStudent, ImportStudents, request, normalize, message, statusText };

function ManageStudent({ turmaId, turmaName, student, close, saved }: { turmaId: string; turmaName: string; student: AdminStudent; close: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [removing, setRemoving] = useState(false);
  const [grant, setGrant] = useState<{ url: string; expiresAt: string } | null>(null);
  async function generate() {
    setBusy(true); setError("");
    try { setGrant(await request(`/api/admin/turmas/${turmaId}/access`, { userId: student.id, purpose: student.status === "pending" ? "activation" : "password_reset" })); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try { await request(`/api/admin/turmas/${turmaId}/members`, { userId: student.id }, "DELETE"); saved(); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }

  return <Dialog title={student.name} description={student.email} close={close} busy={busy} drawer>
    <dl className="admin-student-details"><div><dt>Acesso</dt><dd><span className={`admin-badge ${student.isDemo ? "is-muted" : `is-${student.status}`}`}>{student.isDemo ? "Perfil de exemplo" : statusText[student.status]}</span></dd></div><div><dt>Turmas</dt><dd>{student.turmaNames.join(", ")}</dd></div></dl>
    {!student.isDemo && student.status !== "suspended" && <section className="admin-access"><h3>{student.status === "pending" ? "Ativação da conta" : "Definir senha"}</h3><p>{student.status === "pending" ? "O estudante pode entrar com seu Google cadastrado ou ativar a conta por este link." : "O link permite definir uma senha e encerra as sessões existentes quando utilizado."}</p><button type="button" className="button button-outline" disabled={busy} onClick={generate}><Icon name="link" size={17}/>{busy ? "Gerando..." : grant ? "Gerar novo link" : student.status === "pending" ? "Gerar link de ativação" : "Gerar link para definir senha"}</button>{grant && <AccessLinkBox key={grant.url} grant={grant} name={student.name} activation={student.status === "pending"}/>}</section>}
    <section className="admin-remove-membership"><h3>Participação nesta turma</h3><p>{removing ? `Remover de ${turmaName}? O perfil, as outras turmas e a autoria dos projetos serão preservados.` : `Remover de ${turmaName} mantém o perfil e os créditos nos projetos.`}</p>{removing ? <div className="admin-inline-actions"><button className="button button-outline" disabled={busy} onClick={() => setRemoving(false)}>Cancelar</button><button className="button button-outline admin-danger" disabled={busy} onClick={remove}>{busy ? "Removendo..." : "Confirmar remoção"}</button></div> : <button type="button" className="button button-outline admin-danger" disabled={busy} onClick={() => setRemoving(true)}>Remover da turma</button>}</section><ErrorText text={error}/>
  </Dialog>;
}
