"use client";

import { FieldError, useFormFeedback } from "./form-feedback";
import { identityErrors, rejectFields } from "@/lib/form-validation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminTurma, ImportPreview, StudentLookup, StudentAdded } from "@/lib/admin-types";
import { Icon } from "./icon";
import { AccessLinkBox, Dialog, ErrorText, Search, type Grant } from "./admin-ui";
import { message, turmasApi, type StudentCandidate } from "@/lib/admin-client";

export function AddStudent({ turmaId, turmaName, turmas, close, saved }: { turmaId?: string; turmaName?: string; turmas?: AdminTurma[]; close: () => void; saved: () => void }) {
  const [selectedTurma, setSelectedTurma] = useState("");
  const activeTurmaId = turmaId || selectedTurma;
  const activeTurmaName = turmaName || turmas?.find(t => t.id === activeTurmaId)?.name;
  const [mode, setMode] = useState("new"), [query, setQuery] = useState(""), [chosen, setChosen] = useState("");
  const [email, setEmail] = useState(""), [name, setName] = useState("");
  const [lookup, setLookup] = useState<{ email: string; student: StudentLookup | null } | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const feedback = useFormFeedback();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [added, setAdded] = useState<StudentAdded | null>(null), [grant, setGrant] = useState<Grant | null>(null);
  const [remoteCandidates, setRemoteCandidates] = useState<{ key: string; people: StudentCandidate[] } | null>(null);
  const [candidateError, setCandidateError] = useState(""), [candidateAttempt, setCandidateAttempt] = useState(0);
  const candidateKey = `${activeTurmaId}:${query}`;
  const filtered = remoteCandidates?.key === candidateKey ? remoteCandidates.people : [];
  const checkingCandidates = mode === "existing" && !!activeTurmaId && remoteCandidates?.key !== candidateKey && !candidateError;
  const normalizedEmail = email.trim().toLowerCase();
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const checking = mode === "new" && !!activeTurmaId && validEmail && lookup?.email !== normalizedEmail && !lookupError;
  const found = lookup?.email === normalizedEmail ? lookup.student : null;
  useEffect(() => {
    if (mode !== "new" || added || !validEmail || !activeTurmaId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const student = await turmasApi.lookup(activeTurmaId, normalizedEmail, controller.signal);
        if (!controller.signal.aborted) { setLookup({ email: normalizedEmail, student }); setLookupError(""); }
      } catch { if (!controller.signal.aborted) setLookupError("Não foi possível verificar o email. Altere-o ou tente novamente."); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, added, validEmail, normalizedEmail, activeTurmaId, lookupAttempt]);
  useEffect(() => {
    if (mode !== "existing" || added || !activeTurmaId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const people = await turmasApi.candidates(activeTurmaId, query, controller.signal);
        if (!controller.signal.aborted) { setRemoteCandidates({ key: candidateKey, people }); setCandidateError(""); }
      } catch { if (!controller.signal.aborted) setCandidateError("Não foi possível buscar os perfis. Tente novamente."); }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [mode, added, activeTurmaId, query, candidateKey, candidateAttempt]);
  async function generate(student: StudentAdded) {
    setBusy(true); setError("");
    try { setGrant(await turmasApi.access(activeTurmaId, student.id, "activation")); }
    catch { setError("O estudante foi adicionado. Não foi possível criar o link; tente gerar novamente."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; const formElement = event.currentTarget; setError("");
    if (mode === "new" && !feedback.validate(() => rejectFields(identityErrors(found?.name || name, normalizedEmail)), formElement)) return;
    setBusy(true);
    try {
      let student: StudentAdded;
      if (mode === "existing") {
        const person = filtered.find(p => p.id === chosen);
        if (!person) throw new Error("Escolha uma pessoa.");
        await turmasApi.membership(activeTurmaId, chosen, true);
        student = { ...person, created: false };
      } else {
        if (checking || lookupError || !validEmail || lookup?.email !== normalizedEmail || found?.member || found?.blocked) throw new Error("Confira o email e aguarde a verificação.");
        student = await turmasApi.add(activeTurmaId, found?.name || name, normalizedEmail);
      }
      setAdded(student); saved();
      if (student.created && student.status === "pending") await generate(student);
    } catch (error) { feedback.report(error, formElement); }
    finally { setBusy(false); }
  }
  const canSubmit = !!activeTurmaId && (mode === "existing" ? !!chosen && !checkingCandidates && !candidateError : validEmail && !checking && !lookupError && lookup?.email === normalizedEmail && !found?.blocked && !found?.member);
  function reset() { feedback.reset(); setAdded(null); setGrant(null); setMode("new"); setEmail(""); setName(""); setLookup(null); setLookupError(""); setError(""); setChosen(""); setQuery(""); setRemoteCandidates(null); setCandidateError(""); }
  return <Dialog context={activeTurmaName} title={added ? "Estudante adicionado" : "Adicionar estudante"} description={added ? added.email : undefined} close={close} busy={busy} drawer>
    {added ? <div className="admin-add-success"><div className="admin-success-mark"><Icon name="check" size={24}/></div><h3>{added.name}</h3><p>{added.created ? "O perfil foi criado e adicionado à turma." : "O perfil existente foi adicionado à turma. Seus dados foram preservados."}</p>
      {added.status === "pending" && <><p>Envie a mensagem de ativação para o email cadastrado. O estudante poderá usar o Google ou criar uma senha.</p>{grant ? <AccessLinkBox grant={grant} name={added.name} activation/> : <button className="button button-outline" type="button" disabled={busy} onClick={() => generate(added)}>{busy ? "Preparando link..." : "Gerar link de ativação"}</button>}</>}
      <ErrorText text={error || feedback.error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" disabled={busy} onClick={reset}>Adicionar outro</button><button type="button" className="button button-dark" disabled={busy} onClick={close}>Concluir</button></div>
    </div> : <><div className="admin-mode-tabs"><button type="button" aria-pressed={mode === "new"} disabled={busy} onClick={() => { setMode("new"); feedback.reset(); setError(""); }}>Novo cadastro</button><button type="button" aria-pressed={mode === "existing"} disabled={busy} onClick={() => { setMode("existing"); feedback.reset(); setError(""); }}>Perfil existente</button></div><form noValidate aria-busy={busy} onSubmit={submit}><fieldset className="account-fieldset" disabled={busy}>
      {!turmaId && <div className="form-field"><label htmlFor="add-student-turma">Turma</label><select id="add-student-turma" required value={selectedTurma} onChange={event => { setSelectedTurma(event.target.value); setLookup(null); setLookupError(""); setChosen(""); setError(""); setCandidateError(""); }}><option value="">Selecione uma turma</option>{turmas?.map(t => <option key={t.id} value={t.id}>{t.name}{t.courseName ? ` · ${t.courseName}` : ""}{t.archived ? " · Arquivada" : ""}</option>)}</select></div>}
      {mode === "new" ? <><div className="form-field"><label htmlFor="student-email">Email</label><input id="student-email" name="email" type="email" required maxLength={254} value={email} onChange={e => { feedback.clear("email"); setEmail(e.target.value); setLookup(null); setName(""); setLookupError(""); setError(""); }} autoComplete="off" autoFocus aria-invalid={!!feedback.fields.email} aria-describedby={`student-lookup-status${feedback.fields.email ? " student-email-error" : ""}`}/><FieldError id="student-email-error" text={feedback.fields.email}/></div>
        <div id="student-lookup-status" className="admin-lookup-status" role="status">{checking ? "Verificando email..." : lookupError ? lookupError : found?.member ? "Já participa desta turma." : found?.blocked ? found.reason : found ? "Este perfil já existe. Você pode adicioná-lo à turma." : lookup?.email === normalizedEmail ? "Novo email. Informe o nome para criar o perfil." : ""}</div>
        {lookupError && <button type="button" className="button button-outline admin-small-button" onClick={() => { setLookupError(""); setLookupAttempt(n => n + 1); }}>Tentar novamente</button>}
        <div className="form-field"><label htmlFor="student-name">Nome completo</label><input id="student-name" name="name" required minLength={2} maxLength={70} value={found?.name || name} onChange={e => { setName(e.target.value); feedback.clear("name"); }} aria-invalid={!!feedback.fields.name} aria-describedby={feedback.fields.name ? "student-name-error" : undefined} readOnly={!!found || checking} autoComplete="off"/><FieldError id="student-name-error" text={feedback.fields.name}/></div>
      </> : <><Search value={query} change={value => { setQuery(value); setChosen(""); setCandidateError(""); }} placeholder="Buscar perfil cadastrado"/>{activeTurmaId && <p className="admin-help">Até 25 perfis por busca. Procure por nome ou email.</p>}<div className="admin-candidates" role="group" aria-label="Perfis disponíveis" aria-busy={checkingCandidates}>{checkingCandidates ? <p className="admin-help" role="status">Buscando perfis...</p> : candidateError ? <><ErrorText text={candidateError}/><button type="button" className="button button-outline admin-small-button" onClick={() => { setCandidateError(""); setCandidateAttempt(n => n + 1); }}>Tentar novamente</button></> : filtered.length ? filtered.map(p => <label key={p.id} className="admin-candidate"><input type="radio" name="person" value={p.id} checked={chosen === p.id} onChange={() => setChosen(p.id)}/><span><strong>{p.name}</strong><small>{p.email}{p.isDemo ? " · Perfil de exemplo" : ""}</small></span></label>) : <p className="admin-help">{!activeTurmaId ? "Selecione uma turma para buscar perfis." : "Nenhum perfil disponível."}</p>}</div></>}
      <ErrorText text={error || feedback.error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" onClick={close}>Cancelar</button><button type="submit" className="button button-dark" disabled={!canSubmit}>{busy ? "Adicionando..." : mode === "new" && !found ? "Criar e adicionar" : "Adicionar à turma"}</button></div>
    </fieldset></form></>}
  </Dialog>;
}

export function ImportStudents({ turmaId, turmaName, turmas, close, saved }: { turmaId?: string; turmaName?: string; turmas?: AdminTurma[]; close: () => void; saved: (text: string) => void }) {
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
    try { const data = await turmasApi.import(activeTurmaId, text, "preview"); setRows(data.preview); setExcluded([]); }
    catch (error) { setError(message(error)); } finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true); setError("");
    try { const data = await turmasApi.import(activeTurmaId, text, "confirm", excluded); setResult(data); saved("Importação concluída."); }
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
