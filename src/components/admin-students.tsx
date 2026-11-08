"use client";

import { FormValidationError, identityErrors } from "@/lib/form-validation";
import { focusFirstError } from "./form-feedback";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminTurmaChoice, ManagedStudent, StudentListPage } from "@/lib/admin-types";
import { studentListHref, type StudentListParams } from "@/lib/student-list-params";
import { SelectMenu } from "./select-menu";
import { AdminTurmaFilter } from "./admin-turma-filter";
import { Icon } from "./icon";
import { Avatar, useToast } from "./ui";
import { AccessLinkBox, AccessLinkStatus, Dialog, ErrorText, Search } from "./admin-ui";
import { AddStudent, ImportStudents } from "./admin-student-forms";
import { message, studentsApi, statusText } from "@/lib/admin-client";

function StatusBadge({ student }: { student: ManagedStudent }) {
  return <span className={`admin-badge ${student.isDemo ? "is-muted" : `is-${student.status}`}`}>{student.isDemo ? "Perfil de exemplo" : statusText[student.status]}</span>;
}

export function StudentsList({ result, turmas, owner }: { result: StudentListPage; turmas: AdminTurmaChoice[]; owner: boolean }) {
  const { students, total, filters } = result;
  const router = useRouter(), notify = useToast();
  const [search, setSearch] = useState({ source: filters.query, value: filters.query });
  const [submittedQuery, setSubmittedQuery] = useState(filters.query);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Retain newer typing while a previous search navigation finishes.
  if (search.source !== filters.query) setSearch({ source: filters.query, value: search.value.trim() === submittedQuery ? filters.query : search.value });
  const [modal, setModal] = useState<"add" | "import" | null>(null), [selectedId, setSelectedId] = useState("");
  const [refreshing, startTransition] = useTransition();
  useEffect(() => {
    if (search.value.trim() === filters.query) return;
    timer.current = setTimeout(() => {
      const query = search.value.trim().slice(0, 254);
      setSubmittedQuery(query); setSelectedId("");
      startTransition(() => router.replace(studentListHref({ ...filters, query, page: 1 }), { scroll: false }));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [search.value, filters, router]);
  function navigate(patch: Partial<StudentListParams>) {
    clearTimeout(timer.current);
    const query = search.value.trim().slice(0, 254);
    setSubmittedQuery(query); setSelectedId("");
    const next = { ...filters, query, page: 1, ...patch };
    startTransition(() => router.push(studentListHref(next), { scroll: false }));
  }
  const selected = students.find(person => person.id === selectedId);
  const pages = Math.max(1, Math.ceil(total / filters.pageSize));
  const hasFilters = !!filters.query || filters.turmaId !== "all" || filters.status !== "all";
  function refresh(text: string) { notify(text); startTransition(() => router.refresh()); }
  return <>
    <div className="admin-heading"><div><h1>Estudantes</h1><p>Gerencie participantes, turmas e acesso à galeria.</p></div><div className="admin-heading-actions"><button type="button" className="button button-outline" onClick={() => setModal("import")}><Icon name="upload" size={17}/>Importar lista</button><button type="button" className="button button-dark" onClick={() => setModal("add")}><Icon name="plus" size={17}/>Adicionar estudante</button></div></div>
    <div className="admin-toolbar students-toolbar"><Search value={search.value} change={value => setSearch(current => ({ ...current, value: value.slice(0, 254) }))} placeholder="Buscar por nome ou email"/><AdminTurmaFilter value={filters.turmaId} disabled={refreshing} onChange={turmaId => navigate({ turmaId })} turmas={turmas} includeWithoutTurma/><SelectMenu className="admin-filter-field" label="Filtrar por acesso" value={filters.status} disabled={refreshing} onChange={status => navigate({ status })} options={[{ value: "all", label: "Todos os acessos" }, { value: "pending", label: "Pendentes" }, { value: "active", label: "Ativos" }, { value: "suspended", label: "Suspensos" }, { value: "demo", label: "Perfis de exemplo" }]}/><p className="results-count" role="status"><strong>{total}</strong> {total === 1 ? "estudante" : "estudantes"}{refreshing && <span className="sr-only"> · Atualizando</span>}</p></div>
    <div className="admin-list" aria-busy={refreshing}>{students.length ? <table className="admin-table student-table"><thead><tr><th scope="col">Estudante</th><th scope="col">Turmas</th><th scope="col">Acesso</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>{students.map(person => <tr key={person.id}><td><div className="admin-person"><Avatar person={person} size={38}/><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td><td data-label="Turmas"><span className="admin-student-turmas">{person.turmaNames.join(", ") || "Sem turma"}</span></td><td><StatusBadge student={person}/></td><td className="admin-actions-cell"><button type="button" className="button button-outline admin-small-button" disabled={refreshing || (!owner && person.role !== "user")} aria-label={`Gerenciar ${person.name}`} onClick={() => setSelectedId(person.id)}><Icon name="user" size={16}/>Gerenciar</button></td></tr>)}</tbody></table> : <div className="admin-empty"><Icon name="users" size={30}/><h3>{hasFilters ? "Nenhum estudante encontrado" : "Adicione os primeiros estudantes"}</h3><p>{hasFilters ? "Ajuste a busca ou os filtros para encontrar uma pessoa." : "Cadastre uma pessoa ou importe a lista de uma turma."}</p></div>}</div>
    <div className="admin-pagination">
      <p>{total ? `${(filters.page - 1) * filters.pageSize + 1}–${Math.min(filters.page * filters.pageSize, total)} de ${total}` : "0 estudantes"}</p>
      <label className="admin-page-size">Por página<select className="admin-select" value={filters.pageSize} disabled={refreshing} onChange={event => navigate({ pageSize: event.target.value === "50" ? 50 : 25 })}><option value="25">25</option><option value="50">50</option></select></label>
      <nav aria-label="Paginação de estudantes"><button className="button button-outline admin-small-button" type="button" disabled={refreshing || filters.page <= 1} onClick={() => navigate({ page: filters.page - 1 })}><Icon name="arrow-left" size={16}/>Anterior</button><span aria-live="polite">{filters.page} de {pages}</span><button className="button button-outline admin-small-button" type="button" disabled={refreshing || filters.page >= pages} onClick={() => navigate({ page: filters.page + 1 })}>Próxima<Icon name="arrow-right" size={16}/></button></nav>
    </div>
    {modal === "add" && <AddStudent turmas={turmas} close={() => setModal(null)} saved={() => refresh("Estudante adicionado à turma.")}/>}
    {modal === "import" && <ImportStudents turmas={turmas} close={() => setModal(null)} saved={refresh}/>}
    {selected && <StudentPanel key={selected.id} student={selected} turmas={turmas} refreshing={refreshing} close={() => setSelectedId("")} saved={refresh}/>}
  </>;
}

function StudentPanel({ student, turmas, refreshing, close, saved }: { student: ManagedStudent; turmas: AdminTurmaChoice[]; refreshing: boolean; close: () => void; saved: (text: string) => void }) {
  const [selectedTurmas, setSelectedTurmas] = useState(student.turmaIds);
  const [primaryTurmaId, setPrimaryTurmaId] = useState(student.primaryTurmaId);
  const [membershipSnapshot, setMembershipSnapshot] = useState({ turmaIds: student.turmaIds, primaryTurmaId: student.primaryTurmaId });
  const [membershipError, setMembershipError] = useState("");
  const [addingTurma, setAddingTurma] = useState(false), [turmaQuery, setTurmaQuery] = useState("");
  const turmaSearch = useRef<HTMLInputElement>(null), addTurmaButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (addingTurma) turmaSearch.current?.focus(); }, [addingTurma]);
  const [identity, setIdentity] = useState({ name: student.name, email: student.email });
  const [profileError, setProfileError] = useState(""), [deleteError, setDeleteError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [confirmStatus, setConfirmStatus] = useState(false), [confirmDelete, setConfirmDelete] = useState(false), [grant, setGrant] = useState<{ url: string; expiresAt: string } | null>(null);
  const busy = pending || refreshing;
  const canEditEmail = student.status === "pending" && !student.emailVerified && !student.isDemo;
  const canDelete = canEditEmail && student.role === "user";
  const emailChanged = identity.email.trim().toLowerCase() !== student.email;
  const identityChanged = identity.name.trim() !== student.name || emailChanged;
  const membershipsChanged = selectedTurmas.length !== membershipSnapshot.turmaIds.length || selectedTurmas.some(id => !membershipSnapshot.turmaIds.includes(id));
  const primaryChanged = primaryTurmaId !== membershipSnapshot.primaryTurmaId;
  const primaryOptions = turmas.filter(turma => selectedTurmas.includes(turma.id)).toSorted((a, b) => b.number - a.number);
  const suspended = student.status === "suspended";
  const availableTurmas = turmas.filter(turma => !selectedTurmas.includes(turma.id)).toSorted((a, b) => Number(a.archived) - Number(b.archived) || b.number - a.number);
  const matchingTurmas = availableTurmas.filter(turma => `${turma.name} ${turma.courseName || ""} ${turma.startYear || ""}`.toLocaleLowerCase("pt-BR").includes(turmaQuery.trim().toLocaleLowerCase("pt-BR")));
  function closeTurmaPicker() {
    setAddingTurma(false); setTurmaQuery(""); addTurmaButton.current?.focus();
  }
  async function mutate<T>(operation: () => Promise<T>, text: string) {
    setPending(true); setError("");
    try { const result = await operation(); saved(text); return result; }
    catch (error) { setError(message(error)); return null; }
    finally { setPending(false); }
  }
  async function generate() {
    setPending(true); setError("");
    try { const next = await studentsApi.access(student.id, student.status === "pending" ? "activation" : "password_reset"); setGrant(next); saved("Link preparado para envio manual."); }
    catch (error) { setError(message(error)); } finally { setPending(false); }
  }
  async function saveTurmas() {
    if (busy) return;
    setPending(true); setMembershipError(""); setError("");
    try {
      const snapshot = await studentsApi.memberships(student.id, { turmaIds: selectedTurmas, primaryTurmaId }, membershipSnapshot);
      setMembershipSnapshot(snapshot);
      saved("Participação em turmas atualizada.");
    } catch (error) { setMembershipError(message(error)); }
    finally { setPending(false); }
  }
  async function toggleStatus() {
    const result = await mutate(() => studentsApi.suspend(student.id, !suspended), suspended ? "Acesso restaurado. O estudante precisa entrar novamente." : "Acesso suspenso. Sessões e links anteriores foram revogados.");
    if (result) { setConfirmStatus(false); setGrant(null); }
  }
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; const form = event.currentTarget; setProfileError("");
    const name = identity.name.trim(), email = identity.email.trim().toLowerCase();
    const errors = identityErrors(name, email);
    setFieldErrors(errors);
    if (errors.name || errors.email) { (event.currentTarget.elements.namedItem(errors.name ? "name" : "email") as HTMLInputElement).focus(); return; }
    setPending(true);
    try {
      const result = await studentsApi.profile(student.id, name, email);
      setIdentity({ name: result.name, email: result.email }); setGrant(null);
      saved(result.emailChanged ? "Email atualizado. Os links anteriores foram revogados; gere um novo link de ativação." : "Dados do estudante atualizados.");
    } catch (error) {
      if (error instanceof FormValidationError) { setFieldErrors(error.fieldErrors); focusFirstError(form, error.fieldErrors); }
      else setProfileError(message(error));
    }
    finally { setPending(false); }
  }
  async function deleteProfile() {
    setPending(true); setDeleteError("");
    try { await studentsApi.remove(student.id); close(); saved("Cadastro excluído."); }
    catch (error) { setDeleteError(message(error)); }
    finally { setPending(false); }
  }
  const link = student.accessLink;
  return <Dialog title={student.name} description={student.email} close={close} busy={busy} drawer>
    <dl className="admin-student-details"><div><dt>Acesso</dt><dd><StatusBadge student={student}/></dd></div><div><dt>Turmas</dt><dd>{student.turmaNames.join(", ") || "Sem turma"}</dd></div></dl>
    <section className="admin-student-profile"><h3>Dados do estudante</h3>
      <form onSubmit={saveProfile} noValidate><fieldset className="account-fieldset" disabled={busy}>
        <div className="form-field"><label htmlFor="student-name">Nome</label><input id="student-name" name="name" value={identity.name} required minLength={2} maxLength={70} autoComplete="off" aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "student-name-error" : undefined} onChange={event => { setIdentity(current => ({ ...current, name: event.target.value })); setFieldErrors(current => ({ ...current, name: undefined })); setProfileError(""); }}/>{fieldErrors.name && <p id="student-name-error" className="field-error" role="alert">{fieldErrors.name}</p>}</div>
        <div className="form-field"><label htmlFor="student-email">Email</label><input id="student-email" name="email" type="email" value={identity.email} readOnly={!canEditEmail} required maxLength={254} autoComplete="off" aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "student-email-error" : "student-email-help"} onChange={event => { setIdentity(current => ({ ...current, email: event.target.value })); setFieldErrors(current => ({ ...current, email: undefined })); setProfileError(""); }}/>{fieldErrors.email ? <p id="student-email-error" className="field-error" role="alert">{fieldErrors.email}</p> : <small id="student-email-help">{canEditEmail ? "Alterar o email invalida os links anteriores. Depois de salvar, gere um novo link de ativação." : student.isDemo ? "O email de um perfil de exemplo não pode ser alterado." : "O email só pode ser alterado antes da ativação, enquanto o acesso estiver pendente."}</small>}</div>
        <ErrorText text={profileError}/><button className="button button-dark" type="submit" disabled={!identityChanged}>Salvar alterações</button>
      </fieldset></form>
    </section>

    <section className="admin-student-section">
      <h3>Turmas</h3>
      <p>Adicionar ou remover turmas preserva o perfil e a autoria dos projetos.</p>
      <fieldset className="account-fieldset admin-membership-fields" disabled={busy}>
        <legend className="sr-only">Participação em turmas</legend>
        {primaryOptions.length > 0 && <ul className="admin-student-turma-list">
          {primaryOptions.map(turma => <li key={turma.id}>
            <span><strong>{turma.name}{turma.archived ? " · Arquivada" : ""}</strong><small>{[turma.courseName, turma.startYear].filter(Boolean).join(" · ")}</small></span>
            <button type="button" className="button button-outline admin-small-button" aria-label={`Remover ${turma.name}`} onClick={() => {
              setSelectedTurmas(current => current.filter(id => id !== turma.id));
              if (primaryTurmaId === turma.id) setPrimaryTurmaId(null);
              addTurmaButton.current?.focus();
            }}><Icon name="x" size={16}/>Remover</button>
          </li>)}
        </ul>}
        <button ref={addTurmaButton} type="button" className="button button-outline" aria-expanded={addingTurma} aria-controls="student-add-turma" disabled={!availableTurmas.length} onClick={() => {
          if (addingTurma) closeTurmaPicker(); else setAddingTurma(true);
        }}><Icon name={addingTurma ? "x" : "plus"} size={17}/>{addingTurma ? "Cancelar" : "Adicionar turma"}</button>
        {addingTurma && <div id="student-add-turma" className="admin-turma-picker" onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeTurmaPicker(); }
        }}>
          <div className="search-field admin-search"><Icon name="search" size={19}/><input ref={turmaSearch} aria-label="Buscar turma para adicionar" placeholder="Buscar por turma, curso ou ano" value={turmaQuery} onChange={event => setTurmaQuery(event.target.value)}/></div>
          <div className="admin-candidates admin-turma-options" role="group" aria-label="Turmas disponíveis">
            {matchingTurmas.map(turma => <button type="button" className="admin-candidate admin-turma-option" key={turma.id} onClick={() => {
              setSelectedTurmas(current => current.includes(turma.id) ? current : [...current, turma.id]);
              closeTurmaPicker();
            }}><span><strong>{turma.name}{turma.archived ? " · Arquivada" : ""}</strong><small>{[turma.courseName, turma.startYear].filter(Boolean).join(" · ")}</small></span><Icon name="plus" size={17}/></button>)}
            {!matchingTurmas.length && <p className="admin-help" role="status">Nenhuma turma encontrada.</p>}
          </div>
        </div>}
        {!availableTurmas.length && <p className="admin-help">{turmas.length ? "Esta pessoa participa de todas as turmas cadastradas." : "Crie uma turma para adicionar esta pessoa."}</p>}
        {primaryOptions.length > 1 && <div className="form-field">
          <label htmlFor="student-primary-turma">Turma exibida no perfil</label>
          <select id="student-primary-turma" value={primaryTurmaId || ""} onChange={event => setPrimaryTurmaId(event.target.value || null)} aria-describedby="student-primary-turma-help">
            <option value="">Automática — {primaryOptions[0].name}</option>
            {primaryOptions.map(turma => <option key={turma.id} value={turma.id}>{turma.name}</option>)}
          </select>
          <small id="student-primary-turma-help">Exibida no perfil público. Na opção automática, usamos a turma de maior número.</small>
        </div>}
        {!selectedTurmas.length && <p className="admin-help">Sem turma, a conta mantém o acesso, mas não pode publicar novos projetos.</p>}
        <button type="button" className="button button-dark" disabled={!membershipsChanged && !primaryChanged} onClick={saveTurmas}>Salvar turmas</button>
        <ErrorText text={membershipError}/>
      </fieldset>
    </section>
    {!student.isDemo && !suspended && <section className="admin-access admin-student-section"><h3>{student.status === "pending" ? "Ativação da conta" : "Definir senha"}</h3><p>{student.status === "pending" ? "O estudante pode usar seu Google cadastrado ou criar uma senha pelo link de ativação." : "O link permite definir uma senha. Quando utilizado, encerra as sessões existentes."}</p>{emailChanged ? <p className="admin-help">Salve o novo email antes de gerar outro link.</p> : link && !grant && <AccessLinkStatus link={link}/>}<div className="admin-inline-actions"><button type="button" className="button button-outline" disabled={busy || emailChanged} onClick={generate}><Icon name="link" size={17}/>{pending ? "Preparando..." : link?.state === "valid" || grant ? "Gerar novo link" : student.status === "pending" ? "Gerar link de ativação" : "Gerar link para definir senha"}</button>{link?.state === "valid" && <button type="button" className="button button-outline" disabled={busy} onClick={async () => { if (await mutate(() => studentsApi.revoke(student.id, link.id), "Link revogado.")) setGrant(null); }}>Revogar link</button>}</div>{grant && !emailChanged && <AccessLinkBox grant={grant} name={student.name} activation={student.status === "pending"}/>}</section>}
    {!student.isDemo && student.role === "user" && <section className="admin-student-section"><h3>Acesso à conta</h3><p>{suspended ? "O acesso está suspenso. Restaurar permite entrar novamente; uma conta ainda não ativada continuará pendente." : "Suspender bloqueia o acesso e revoga sessões e links. Perfil, turmas, projetos e créditos são mantidos."}</p>{confirmStatus ? <><p className="admin-status-confirm">{suspended ? "Restaurar o acesso desta pessoa?" : "Suspender o acesso desta pessoa?"}</p><div className="admin-inline-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => setConfirmStatus(false)}>Cancelar</button><button type="button" className={`button ${suspended ? "button-dark" : "button-outline admin-danger"}`} disabled={busy} onClick={toggleStatus}>{pending ? "Salvando..." : suspended ? "Confirmar restauração" : "Confirmar suspensão"}</button></div></> : <button type="button" className={`button button-outline ${suspended ? "" : "admin-danger"}`} disabled={busy} onClick={() => setConfirmStatus(true)}>{suspended ? "Restaurar acesso" : "Suspender acesso"}</button>}</section>}
    {canDelete && <section className="admin-student-section"><h3>Excluir cadastro</h3>{confirmDelete ? <><p>Excluir o cadastro de <strong>{student.name}</strong> ({student.email})? A participação em todas as turmas e os links de ativação serão removidos. Esta ação não pode ser desfeita.</p><div className="admin-inline-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => { setConfirmDelete(false); setDeleteError(""); }}>Cancelar</button><button type="button" className="button button-outline admin-danger" disabled={busy} onClick={deleteProfile}>{pending ? "Excluindo..." : "Confirmar exclusão"}</button></div></> : <><p>Remova um cadastro incorreto antes da ativação da conta.</p><button type="button" className="button button-outline admin-danger" disabled={busy} onClick={() => setConfirmDelete(true)}><Icon name="trash" size={17}/>Excluir cadastro</button></>}<ErrorText text={deleteError}/></section>}
    <ErrorText text={error}/>
  </Dialog>;
}
