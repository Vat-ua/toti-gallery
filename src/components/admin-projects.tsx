"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AdminProject, AdminProjectPage, AdminTurma } from "@/lib/admin-types";
import { adminProjectHref, type AdminProjectFilters } from "@/lib/admin-project-params";
import { Dialog, ErrorText, Search, message, request } from "./admin-turmas";
import { ProjectCard } from "./project-card";
import { SelectMenu } from "./select-menu";
import { AdminTurmaFilter } from "./admin-turma-filter";
import { Icon } from "./icon";
import { useToast } from "./ui";

export function ProjectModeration({ project, compact = false }: { project: AdminProject; compact?: boolean }) {
  const router = useRouter(), notify = useToast();
  const [open, setOpen] = useState(false), [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [refreshing, startTransition] = useTransition();
  const hidden = project.visibility === "hidden";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await request(`/api/admin/projetos/${project.id}`, { action: hidden ? "restore" : "hide", expectedVisibility: project.visibility, reason });
      setOpen(false); setReason("");
      notify(hidden ? "Projeto restaurado." : "Projeto ocultado.");
      startTransition(() => router.refresh());
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className={`project-moderation-action ${compact ? "" : "button button-outline admin-small-button"} ${hidden ? "is-accent" : ""}`} disabled={refreshing} onClick={() => { setError(""); setOpen(true); }} aria-label={`${hidden ? "Restaurar" : "Ocultar"}: ${project.title}`}><Icon name={hidden ? "restore" : "eye-off"} size={15}/>{hidden ? "Restaurar" : "Ocultar"}</button>
    {open && <Dialog title={hidden ? "Restaurar projeto?" : "Ocultar projeto"} description={project.title} close={() => setOpen(false)} busy={busy} drawer>
      <form onSubmit={submit}><fieldset disabled={busy} className="account-fieldset">
        {hidden ? <div className="project-moderation-note"><strong>Motivo do ocultamento</strong><p>{project.moderationReason}</p></div> : <div className="form-field"><label htmlFor="moderation-reason">Motivo <span className="required-dot">*</span></label><textarea id="moderation-reason" value={reason} onChange={event => setReason(event.target.value)} required maxLength={1000} rows={5} autoFocus aria-describedby="moderation-help"/><p className="admin-help" id="moderation-help">Visível para a administração e para o responsável pela publicação.</p></div>}
        <ErrorText text={error}/><div className="admin-dialog-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Cancelar</button><button type="submit" className={`button ${hidden ? "button-accent" : "button-dark"}`} disabled={!hidden && !reason.trim()}>{busy ? "Salvando..." : hidden ? "Restaurar" : "Ocultar"}</button></div>
      </fieldset></form>
    </Dialog>}
  </>;
}

export function AdminProjects({ result, turmas = [], scopedTurmaId }: { result: AdminProjectPage; turmas?: AdminTurma[]; scopedTurmaId?: string }) {
  const { projects, total, filters } = result;
  const router = useRouter();
  const [search, setSearch] = useState({ source: filters.query, value: filters.query });
  const [submittedQuery, setSubmittedQuery] = useState(filters.query);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [refreshing, startTransition] = useTransition();
  if (search.source !== filters.query) setSearch({ source: filters.query, value: search.value.trim() === submittedQuery ? filters.query : search.value });
  useEffect(() => {
    if (search.value.trim() === filters.query) return;
    timer.current = setTimeout(() => {
      const query = search.value.trim(); setSubmittedQuery(query);
      startTransition(() => router.replace(adminProjectHref({ ...filters, query, page: 1 }, scopedTurmaId), { scroll: false }));
    }, 350);
    return () => clearTimeout(timer.current);
  }, [search.value, filters, scopedTurmaId, router]);
  function navigate(patch: Partial<AdminProjectFilters>, replace = false) {
    clearTimeout(timer.current);
    const query = search.value.trim(); setSubmittedQuery(query);
    startTransition(() => router[replace ? "replace" : "push"](adminProjectHref({ ...filters, query, page: 1, ...patch }, scopedTurmaId), { scroll: false }));
  }
  const returnTo = adminProjectHref(filters, scopedTurmaId);
  const filtered = !!filters.query || filters.visibility !== "all" || (!scopedTurmaId && filters.turmaId !== "all");
  return <>
    {!scopedTurmaId && <div className="admin-heading"><div><h1>Projetos</h1><p>Gerencie a visibilidade das publicações da galeria.</p></div></div>}
    <div className="admin-toolbar admin-project-toolbar"><Search value={search.value} change={value => setSearch(current => ({ ...current, value: value.slice(0, 254) }))} placeholder="Buscar por projeto ou autor"/>
      {!scopedTurmaId && <AdminTurmaFilter value={filters.turmaId} disabled={refreshing} onChange={turmaId => navigate({ turmaId })} turmas={turmas}/>}
      <SelectMenu className="admin-filter-field" label="Filtrar por publicação" value={filters.visibility} disabled={refreshing} onChange={visibility => navigate({ visibility })} options={[{ value: "all", label: "Todas as publicações" }, { value: "published", label: "Publicados" }, { value: "hidden", label: "Ocultos" }]}/>
      <p className="results-count" role="status"><strong>{total}</strong> {total === 1 ? "projeto" : "projetos"}{refreshing && <span className="sr-only"> · Atualizando</span>}</p>
    </div>
    <div aria-busy={refreshing} className="admin-project-results">
      {projects.length ? <div className="management-grid admin-project-grid">{projects.map(project => {
        const href = `/admin/projetos/${project.id}?returnTo=${encodeURIComponent(returnTo)}`;
        return <div className="management-card admin-project-card" key={project.id}>
          <ProjectCard project={project} href={href} readOnly/>
          <div className="management-actions admin-project-actions"><Link href={href} aria-label={`Visualizar ${project.title}`}><Icon name="eye" size={15}/>Visualizar</Link><ProjectModeration project={project} compact/></div>
        </div>;
      })}</div> : <div className="admin-list admin-empty"><Icon name="code" size={30}/><h3>{filtered ? "Nenhum projeto encontrado" : "Ainda não há projetos"}</h3><p>{filtered ? "Ajuste a busca ou os filtros para encontrar uma publicação." : "Os projetos publicados pelos estudantes aparecerão aqui."}</p></div>}
    </div>
    {projects.length < total && <div className="load-more-area">
      <button className="button button-outline load-more" type="button" disabled={refreshing} onClick={() => navigate({ page: filters.page + 1 }, true)}>{refreshing ? "Carregando..." : "Carregar mais projetos"}<Icon name="arrow-down" size={18}/></button>
      <p className="load-count">Mostrando {projects.length} de {total}</p>
    </div>}
  </>;
}
