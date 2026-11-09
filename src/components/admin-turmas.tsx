"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import type { AdminStudent, AdminTurma } from "@/lib/admin-types";
import { SelectMenu } from "./select-menu";
import { Icon } from "./icon";
import { AccessLinkBox, Dialog, ErrorText, Search } from "./admin-ui";
import { AddStudent, ImportStudents } from "./admin-student-forms";
import { message, normalize, turmasApi, statusText } from "@/lib/admin-client";
import { FieldError, useFormFeedback } from "./form-feedback";
import { rejectFields, turmaErrors } from "@/lib/form-validation";
import { Avatar, useToast } from "./ui";

function Empty({ title, text }: { title: string; text: string }) { return <div className="admin-empty"><Icon name="users" size={30}/><h3>{title}</h3><p>{text}</p></div>; }
function TurmaForm({ turma, close, saved }: { turma?: Pick<AdminTurma, "id" | "name" | "number" | "courseName" | "startYear" | "archived">; close: () => void; saved: (id: string, text?: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [expected] = useState(() => turma ? { number: turma.number, courseName: turma.courseName, startYear: turma.startYear } : undefined);
  const feedback = useFormFeedback();
  const [confirmArchive, setConfirmArchive] = useState(false), [archiveError, setArchiveError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; const formElement = event.currentTarget; const fields = new FormData(event.currentTarget); setError("");
    const value = { number: Number(fields.get("number")), courseName: String(fields.get("courseName")), startYear: Number(fields.get("startYear")) };
    if (!feedback.validate(() => rejectFields(turmaErrors(value)), formElement)) return;
    setBusy(true);
    try { const data = await turmasApi.save(turma?.id, value, expected); saved(data.id); }
    catch (error) { feedback.report(error, formElement); } finally { setBusy(false); }
  }
  async function archive() {
    if (!turma) return;
    setBusy(true); setArchiveError("");
    try { await turmasApi.archive(turma.id, !turma.archived); saved(turma.id, turma.archived ? "Turma desarquivada." : "Turma arquivada."); }
    catch (error) { setArchiveError(message(error)); } finally { setBusy(false); }
  }
  return <Dialog title={turma ? "Editar turma" : "Nova turma"} description={turma ? undefined : "Informe o curso e o ano de início desta turma."} close={close} busy={busy} drawer><form noValidate aria-busy={busy} onChange={event => { const target = event.target; if (target instanceof HTMLInputElement) feedback.clear(target.name); }} onSubmit={submit}><fieldset disabled={busy || confirmArchive} className="account-fieldset">
    <div className="form-field"><label htmlFor="turma-number">Número da turma</label><input id="turma-number" name="number" aria-invalid={!!feedback.fields.number} aria-describedby={feedback.fields.number ? "turma-number-error" : undefined} type="number" required min={1} max={999999999} defaultValue={expected?.number} placeholder="26" autoFocus/><FieldError id="turma-number-error" text={feedback.fields.number}/></div>
    <div className="form-field"><label htmlFor="turma-course">Nome do curso</label><input id="turma-course" name="courseName" aria-invalid={!!feedback.fields.courseName} aria-describedby={feedback.fields.courseName ? "turma-course-error" : undefined} required minLength={2} maxLength={100} defaultValue={expected?.courseName || ""} placeholder="Full Stack"/><FieldError id="turma-course-error" text={feedback.fields.courseName}/></div>
    <div className="form-field"><label htmlFor="turma-year">Ano de início</label><input id="turma-year" name="startYear" aria-invalid={!!feedback.fields.startYear} aria-describedby={feedback.fields.startYear ? "turma-year-error" : undefined} type="number" required min={2000} max={2100} defaultValue={expected?.startYear || ""} placeholder="2026"/><FieldError id="turma-year-error" text={feedback.fields.startYear}/></div>
    <ErrorText text={error || feedback.error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" onClick={close}>Cancelar</button><button className="button button-dark" type="submit">{busy ? "Salvando..." : turma ? "Salvar alterações" : "Criar turma"}</button></div>
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

type DetailProps = { turma: Pick<AdminTurma, "id" | "name" | "number" | "courseName" | "startYear" | "archived">; members: AdminStudent[]; memberCount: number; projectCount: number; projectContent: ReactNode | null; owner: boolean };
export function TurmaDetail({ turma, members, memberCount, projectCount, projectContent, owner }: DetailProps) {
  const router = useRouter(), notify = useToast();
  const tab = projectContent ? "projects" : "students";
  const [query, setQuery] = useState(""), [status, setStatus] = useState("all");
  const [modal, setModal] = useState<"edit" | "archive" | "add" | "import" | null>(null), [selected, setSelected] = useState<AdminStudent | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const filtered = members.filter(m => normalize(m.name + " " + m.email).includes(normalize(query)) && (status === "all" || (!m.isDemo && m.status === status) || (status === "demo" && m.isDemo)));
  function refresh(text: string) { setModal(null); setSelected(null); notify(text); router.refresh(); }
  async function archive() {
    setBusy(true); setError("");
    try { await turmasApi.archive(turma.id, !turma.archived); refresh(turma.archived ? "Turma desarquivada." : "Turma arquivada."); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  return <>
    <Link className="back-link admin-back" href="/admin/turmas"><Icon name="arrow-left" size={16}/>Turmas</Link>
    <div className="admin-heading"><div><div className="admin-title-line"><h1>{turma.name}</h1>{turma.archived && <span className="admin-badge is-muted">Arquivada</span>}</div><p>{memberCount} {memberCount === 1 ? "estudante" : "estudantes"} · {projectCount} {projectCount === 1 ? "projeto" : "projetos"}{turma.courseName && ` · ${turma.courseName}`}{turma.startYear && ` · ${turma.startYear}`}</p></div><div className="admin-heading-actions"><button type="button" className="button button-outline" onClick={() => setModal("edit")}><Icon name="edit" size={17}/>Editar turma</button><button type="button" className="button button-outline" onClick={() => { setError(""); setModal("archive"); }}>{turma.archived ? "Desarquivar" : "Arquivar"}</button></div></div>
    {turma.archived && <p className="admin-notice">Esta turma está arquivada. Seus participantes continuam com acesso e podem publicar projetos.</p>}
    <div className="admin-detail-tabs" role="group" aria-label="Conteúdo da turma"><button type="button" aria-pressed={tab === "students"} onClick={() => router.push(`/admin/turmas/${turma.id}`, { scroll: false })}>Estudantes <span>{memberCount}</span></button><button type="button" aria-pressed={tab === "projects"} onClick={() => router.push(`/admin/turmas/${turma.id}?tab=projetos`, { scroll: false })}>Projetos <span>{projectCount}</span></button></div>
    {tab === "students" ? <>
      <div className="admin-toolbar"><Search value={query} change={setQuery} placeholder="Buscar por nome ou email"/><SelectMenu className="admin-filter-field" label="Filtrar estudantes por acesso" value={status} onChange={setStatus} options={[{ value: "all", label: "Todos os acessos" }, { value: "pending", label: "Pendentes" }, { value: "active", label: "Ativos" }, { value: "suspended", label: "Suspensos" }, { value: "demo", label: "Perfis de exemplo" }]}/><div className="admin-toolbar-actions"><button type="button" className="button button-outline" onClick={() => setModal("import")}><Icon name="upload" size={17}/>Importar lista</button><button type="button" className="button button-dark" onClick={() => setModal("add")}><Icon name="plus" size={17}/>Adicionar estudante</button></div></div>
      <div className="admin-list">{filtered.length ? <table className="admin-table student-table"><thead><tr><th scope="col">Estudante</th><th scope="col">Outras turmas</th><th scope="col">Acesso</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>{filtered.map(person => <tr key={person.id}><td><div className="admin-person"><Avatar person={person} size={38}/><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td><td data-label="Outras turmas"><span className="admin-muted">{person.turmaNames.filter(n => n !== turma.name).join(", ") || "—"}</span></td><td><span className={`admin-badge ${person.isDemo ? "is-muted" : `is-${person.status}`}`}>{person.isDemo ? "Perfil de exemplo" : statusText[person.status]}</span></td><td className="admin-actions-cell"><button type="button" className="button button-outline admin-small-button" disabled={!owner && person.role !== "user"} onClick={() => setSelected(person)} aria-label={`Gerenciar ${person.name}`}><Icon name="user" size={16}/>Gerenciar</button></td></tr>)}</tbody></table> : <Empty title={members.length ? "Nenhum estudante encontrado" : "Adicione os primeiros estudantes"} text={members.length ? "Tente outro nome, email ou situação de acesso." : "Cadastre uma pessoa, adicione um perfil existente ou importe uma lista."}/>}</div>
    </> : projectContent}
    {modal === "edit" && <TurmaForm turma={turma} close={() => setModal(null)} saved={(_id, text) => refresh(text || "Turma atualizada.")}/>}
    {modal === "archive" && <Dialog context={turma.name} title={turma.archived ? "Desarquivar turma?" : "Arquivar turma?"} description={turma.archived ? "A turma voltará à lista de ativas." : "A turma irá para a lista de arquivadas. Estudantes, projetos e permissões de publicação serão mantidos."} close={() => setModal(null)} busy={busy}><ErrorText text={error}/><div className="admin-dialog-actions"><button className="button button-outline" onClick={() => setModal(null)} disabled={busy}>Cancelar</button><button className="button button-dark" onClick={archive} disabled={busy}>{busy ? "Salvando..." : turma.archived ? "Desarquivar turma" : "Arquivar turma"}</button></div></Dialog>}
    {modal === "add" && <AddStudent turmaId={turma.id} turmaName={turma.name} close={() => setModal(null)} saved={() => { notify("Estudante adicionado à turma."); router.refresh(); }}/>}
    {modal === "import" && <ImportStudents turmaId={turma.id} turmaName={turma.name} close={() => setModal(null)} saved={text => { notify(text); router.refresh(); }}/>}
    {selected && <ManageStudent turmaId={turma.id} turmaName={turma.name} student={selected} close={() => setSelected(null)} saved={() => refresh("Estudante removido desta turma. Perfil e autorias preservados.")}/>}
  </>;
}

function ManageStudent({ turmaId, turmaName, student, close, saved }: { turmaId: string; turmaName: string; student: AdminStudent; close: () => void; saved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [removing, setRemoving] = useState(false);
  const [grant, setGrant] = useState<{ url: string; expiresAt: string } | null>(null);
  async function generate() {
    setBusy(true); setError("");
    try { setGrant(await turmasApi.access(turmaId, student.id, student.status === "pending" ? "activation" : "password_reset")); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setError("");
    try { await turmasApi.membership(turmaId, student.id, false); saved(); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }

  return <Dialog title={student.name} description={student.email} close={close} busy={busy} drawer>
    <dl className="admin-student-details"><div><dt>Acesso</dt><dd><span className={`admin-badge ${student.isDemo ? "is-muted" : `is-${student.status}`}`}>{student.isDemo ? "Perfil de exemplo" : statusText[student.status]}</span></dd></div><div><dt>Turmas</dt><dd>{student.turmaNames.join(", ")}</dd></div></dl>
    {!student.isDemo && student.status !== "suspended" && <section className="admin-access"><h3>{student.status === "pending" ? "Ativação da conta" : "Definir senha"}</h3><p>{student.status === "pending" ? "O estudante pode entrar com seu Google cadastrado ou ativar a conta por este link." : "O link permite definir uma senha e encerra as sessões existentes quando utilizado."}</p><button type="button" className="button button-outline" disabled={busy} onClick={generate}><Icon name="link" size={17}/>{busy ? "Gerando..." : grant ? "Gerar novo link" : student.status === "pending" ? "Gerar link de ativação" : "Gerar link para definir senha"}</button>{grant && <AccessLinkBox key={grant.url} grant={grant} name={student.name} activation={student.status === "pending"}/>}</section>}
    <section className="admin-remove-membership"><h3>Participação nesta turma</h3><p>{removing ? `Remover de ${turmaName}? O perfil, as outras turmas e a autoria dos projetos serão preservados.` : `Remover de ${turmaName} mantém o perfil e os créditos nos projetos.`}</p>{removing ? <div className="admin-inline-actions"><button className="button button-outline" disabled={busy} onClick={() => setRemoving(false)}>Cancelar</button><button className="button button-outline admin-danger" disabled={busy} onClick={remove}>{busy ? "Removendo..." : "Confirmar remoção"}</button></div> : <button type="button" className="button button-outline admin-danger" disabled={busy} onClick={() => setRemoving(true)}>Remover da turma</button>}</section><ErrorText text={error}/>
  </Dialog>;
}
