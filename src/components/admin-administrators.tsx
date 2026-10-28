"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdministratorCandidate, ManagedAdministrator } from "@/lib/admin-types";
import { formatAccessExpiry } from "@/lib/access-message";
import { Avatar, useToast } from "./ui";
import { Icon } from "./icon";
import { AccessLinkBox, Dialog, ErrorText, Search, message, normalize, request, statusText } from "./admin-turmas";

type Grant = { url: string; expiresAt: string };
type AddedAdministrator = { id: string; name: string; email: string; grant: Grant | null };

function StatusBadge({ status }: { status: ManagedAdministrator["status"] }) {
  return <span className={`admin-badge is-${status}`}>{statusText[status]}</span>;
}

export function AdministratorsList({ administrators }: { administrators: ManagedAdministrator[] }) {
  const router = useRouter(), notify = useToast();
  const [query, setQuery] = useState(""), [adding, setAdding] = useState(false), [selectedId, setSelectedId] = useState("");
  const [refreshing, startTransition] = useTransition();
  const selected = administrators.find(person => person.id === selectedId && person.role === "admin");
  const rows = administrators.filter(person => normalize(`${person.name} ${person.email}`).includes(normalize(query)));
  function refresh(text: string) { notify(text); startTransition(() => router.refresh()); }
  return <>
    <div className="admin-heading"><div><h1>Administradores</h1><p>Gerencie quem administra a galeria.</p></div><button type="button" className="button button-dark" onClick={() => setAdding(true)}><Icon name="plus" size={18}/>Adicionar administrador</button></div>
    <div className="admin-toolbar"><Search value={query} change={setQuery} placeholder="Buscar por nome ou email"/><p className="results-count" role="status"><strong>{rows.length}</strong> {rows.length === 1 ? "conta" : "contas"}</p></div>
    <div className="admin-list" aria-busy={refreshing}>{rows.length ? <table className="admin-table"><thead><tr><th scope="col">Pessoa</th><th scope="col">Permissão</th><th scope="col">Acesso</th><th scope="col"><span className="sr-only">Ações</span></th></tr></thead><tbody>{rows.map(person => <tr key={person.id}>
      <td><div className="admin-person"><Avatar person={person} size={38}/><span><strong>{person.name}</strong><small>{person.email}</small></span></div></td>
      <td data-label="Permissão">{person.role === "owner" ? "Proprietário" : "Administrador"}</td>
      <td><StatusBadge status={person.status}/></td>
      <td className="admin-actions-cell">{person.role === "owner" ? <span className="admin-muted">Conta protegida</span> : <button type="button" className="button button-outline admin-small-button" disabled={refreshing} onClick={() => setSelectedId(person.id)} aria-label={`Gerenciar ${person.name}`}><Icon name="user" size={16}/>Gerenciar</button>}</td>
    </tr>)}</tbody></table> : <div className="admin-empty"><Icon name="users" size={30}/><h3>Nenhuma conta encontrada</h3><p>Tente outro nome ou email.</p></div>}</div>
    {adding && <AddAdministrator close={() => setAdding(false)} saved={refresh}/>}
    {selected && <AdministratorPanel key={selected.id} person={selected} refreshing={refreshing} close={() => setSelectedId("")} saved={refresh}/>}
  </>;
}

function AddAdministrator({ close, saved }: { close: () => void; saved: (text: string) => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [query, setQuery] = useState(""), [chosen, setChosen] = useState<AdministratorCandidate | null>(null);
  const [name, setName] = useState(""), [email, setEmail] = useState("");
  const [candidates, setCandidates] = useState<{ query: string; people: AdministratorCandidate[] } | null>(null);
  const [lookupError, setLookupError] = useState(""), [attempt, setAttempt] = useState(0);
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({});
  const [added, setAdded] = useState<AddedAdministrator | null>(null);
  const search = query.trim().slice(0, 254);
  const people = candidates?.query === search ? candidates.people : [];
  const searching = search.length >= 2 && candidates?.query !== search && !lookupError;
  useEffect(() => {
    if (mode !== "existing" || added || search.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/administradores?q=${encodeURIComponent(search)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Não foi possível buscar os perfis.");
        if (!controller.signal.aborted) { setCandidates({ query: search, people: data.candidates }); setLookupError(""); }
      } catch (error) { if (!controller.signal.aborted) setLookupError(message(error)); }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, added, search, attempt]);
  function changeMode(value: "existing" | "new") { setMode(value); setError(""); setFieldErrors({}); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (mode === "new") {
      const errors = {
        name: name.trim().length < 2 || name.trim().length > 70 ? "Informe um nome de 2 a 70 caracteres." : undefined,
        email: email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? "Informe um email válido." : undefined,
      };
      setFieldErrors(errors);
      if (errors.email || errors.name) { (event.currentTarget.elements.namedItem(errors.email ? "email" : "name") as HTMLInputElement).focus(); return; }
    } else if (!chosen) return;
    setPending(true);
    try {
      const result: AddedAdministrator = await request("/api/admin/administradores", mode === "new" ? { action: "create", name, email } : { action: "promote", userId: chosen!.id });
      saved(result.grant ? "Administrador adicionado. Compartilhe o link de ativação." : "Acesso administrativo concedido. A pessoa precisa entrar novamente.");
      if (result.grant) setAdded(result); else close();
    } catch (error) { setError(message(error)); }
    finally { setPending(false); }
  }
  return <Dialog title={added ? "Ativação da conta" : "Adicionar administrador"} description={added ? `${added.name} · ${added.email}` : undefined} close={close} busy={pending} drawer>
    {added?.grant ? <><AccessLinkBox grant={added.grant} name={added.name} activation/><div className="admin-dialog-actions"><button type="button" className="button button-dark" onClick={close}>Concluir</button></div></> : <>
      <div className="admin-segments" aria-label="Origem do perfil">{([['existing', 'Perfil existente'], ['new', 'Novo cadastro']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={mode === value} disabled={pending} onClick={() => changeMode(value)}>{label}</button>)}</div>
      <section className="admin-student-section"><p>Administradores podem gerenciar turmas, estudantes e a moderação de projetos.</p>
        <form onSubmit={submit} noValidate><fieldset className="account-fieldset" disabled={pending}>
          {mode === "existing" ? <>
            <Search value={query} placeholder="Buscar perfil por nome ou email" change={value => { setQuery(value.slice(0, 254)); setChosen(null); setLookupError(""); setError(""); }}/>
            <div className="admin-candidates" aria-label="Perfis disponíveis" aria-busy={searching}>
              {search.length < 2 ? <p className="admin-help">Digite pelo menos 2 caracteres. Perfis de exemplo, suspensos e contas já administrativas não aparecem.</p> : searching ? <p className="admin-help" role="status">Buscando perfis...</p> : lookupError ? <><ErrorText text={lookupError}/><button type="button" className="button button-outline" onClick={() => { setLookupError(""); setAttempt(value => value + 1); }}>Tentar novamente</button></> : people.length ? people.map(person => <label key={person.id} className="admin-candidate"><input type="radio" name="profile" checked={chosen?.id === person.id} onChange={() => setChosen(person)}/><span><strong>{person.name}</strong><small>{person.email} · {statusText[person.status]}</small></span></label>) : <p className="admin-help">Nenhum perfil disponível. Confira a busca ou use Novo cadastro.</p>}
            </div>
            {chosen && <p className="admin-help">Você concederá acesso administrativo a <strong>{chosen.name}</strong>. O perfil, as turmas e os projetos serão mantidos. As sessões e os links anteriores serão encerrados.</p>}
          </> : <>
            <div className="form-field"><label htmlFor="administrator-email">Email</label><input id="administrator-email" name="email" type="email" required maxLength={254} autoComplete="off" value={email} aria-invalid={!!fieldErrors.email} aria-describedby={fieldErrors.email ? "administrator-email-error" : undefined} onChange={event => { setEmail(event.target.value); setFieldErrors(current => ({ ...current, email: undefined })); setError(""); }}/>{fieldErrors.email && <p id="administrator-email-error" className="field-error" role="alert">{fieldErrors.email}</p>}</div>
            <div className="form-field"><label htmlFor="administrator-name">Nome</label><input id="administrator-name" name="name" required minLength={2} maxLength={70} autoComplete="off" value={name} aria-invalid={!!fieldErrors.name} aria-describedby={fieldErrors.name ? "administrator-name-error" : undefined} onChange={event => { setName(event.target.value); setFieldErrors(current => ({ ...current, name: undefined })); setError(""); }}/>{fieldErrors.name && <p id="administrator-name-error" className="field-error" role="alert">{fieldErrors.name}</p>}</div>
            <p className="admin-help">A conta será criada como pendente, sem senha e sem turma. Você receberá um link para enviar manualmente.</p>
          </>}
          <ErrorText text={error}/>
          {mode === "new" && error && <button type="button" className="button button-outline" onClick={() => { changeMode("existing"); setQuery(email); setChosen(null); }}>Buscar perfil existente</button>}
          <div className="admin-dialog-actions"><button type="button" className="button button-outline" onClick={close}>Cancelar</button><button className="button button-dark" type="submit" disabled={mode === "existing" && (!chosen || searching)}>{pending ? "Salvando..." : mode === "new" ? "Cadastrar administrador" : "Conceder acesso"}</button></div>
        </fieldset></form>
      </section>
    </>}
  </Dialog>;
}

function AdministratorPanel({ person, refreshing, close, saved }: { person: ManagedAdministrator; refreshing: boolean; close: () => void; saved: (text: string) => void }) {
  const [pending, setPending] = useState(false), [error, setError] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(false), [grant, setGrant] = useState<Grant | null>(null);
  const busy = pending || refreshing, link = person.accessLink;
  const activation = person.status === "pending";
  const linkState = { valid: "Há um link válido", expired: "O último link expirou", used: "O último link já foi utilizado", revoked: "O último link foi revogado" };
  async function mutate(body: Record<string, unknown>, text: string) {
    setPending(true); setError("");
    try { const result = await request(`/api/admin/administradores/${person.id}`, body); saved(text); return result; }
    catch (error) { setError(message(error)); return null; }
    finally { setPending(false); }
  }
  async function generate() {
    const result = await mutate({ action: "access", purpose: activation ? "activation" : "password_reset" }, "Link preparado para envio manual.");
    if (result) setGrant(result);
  }
  async function remove() {
    if (await mutate({ action: "remove" }, "Acesso administrativo removido. Perfil e projetos preservados.")) close();
  }
  return <Dialog title={person.name} description={person.email} close={close} busy={busy} drawer>
    <dl className="admin-student-details"><div><dt>Permissão</dt><dd>Administrador</dd></div><div><dt>Acesso</dt><dd><StatusBadge status={person.status}/></dd></div></dl>
    {person.status !== "suspended" && <section className="admin-access">
      <h3>{activation ? "Ativação da conta" : "Definir senha"}</h3>
      <p>{activation ? "A pessoa pode entrar com seu Google cadastrado ou criar uma senha pelo link de ativação." : "O link permite definir uma senha e encerra as sessões existentes quando utilizado."}</p>
      {link && !grant && <p className="admin-link-state">{linkState[link.state]}{link.state === "valid" ? ` até ${formatAccessExpiry(link.expiresAt)} (horário de Brasília).` : "."}</p>}
      <div className="admin-inline-actions"><button type="button" className="button button-outline" disabled={busy} onClick={generate}><Icon name="link" size={17}/>{link?.state === "valid" || grant ? "Gerar novo link" : activation ? "Gerar link de ativação" : "Gerar link para definir senha"}</button>{link?.state === "valid" && <button type="button" className="button button-outline" disabled={busy} onClick={async () => { if (await mutate({ action: "revoke-link", grantId: link.id }, "Link revogado.")) setGrant(null); }}>Revogar link</button>}</div>
      {grant && <AccessLinkBox grant={grant} name={person.name} activation={activation}/>}
    </section>}
    <section className="admin-student-section"><h3>Acesso administrativo</h3>
      {confirmRemove ? <><p>Remover o acesso administrativo de <strong>{person.name}</strong>? O perfil, as turmas e os projetos serão mantidos. As sessões e os links de acesso serão encerrados.</p><div className="admin-inline-actions"><button type="button" className="button button-outline" disabled={busy} onClick={() => { setConfirmRemove(false); setError(""); }}>Cancelar</button><button type="button" className="button button-outline admin-danger" disabled={busy} onClick={remove}>{pending ? "Removendo..." : "Confirmar remoção"}</button></div></> : <><p>Remover esta permissão mantém a conta como participante, com seu histórico e acesso conforme o estado atual.</p><button type="button" className="button button-outline admin-danger" disabled={busy} onClick={() => setConfirmRemove(true)}>Remover acesso administrativo</button></>}
    </section>
    <ErrorText text={error}/>
  </Dialog>;
}
