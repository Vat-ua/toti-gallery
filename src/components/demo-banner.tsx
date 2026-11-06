"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useDemoMode } from "./demo-mode";
import { Icon } from "./icon";
import { useToast } from "./ui";

export function DemoBanner() {
  const mode = useDemoMode();
  const router = useRouter();
  const notify = useToast();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close(); }, [open]);
  async function restore() {
    if (pending) return;
    setPending(true);
    try {
      const { resetDemo } = await import("@/lib/demo-store");
      await resetDemo(); mode.restored(); setOpen(false);
      router.push("/demo"); notify("Dados iniciais restaurados.");
    } catch (error) { notify(error instanceof Error ? error.message : "Não foi possível restaurar os dados.", true); }
    finally { setPending(false); }
  }
  return <>
    <div className="demo-banner"><div className="container demo-banner-inner">
      <div className="demo-banner-copy"><strong>Modo de demonstração</strong><span title="Seus projetos de demonstração ficam apenas neste navegador.">Projetos salvos neste navegador.</span></div>
      <div className="demo-banner-actions">
        <button type="button" onClick={() => setOpen(true)} disabled={pending} aria-label="Restaurar dados" title="Restaurar dados"><Icon name="restore" size={16}/><span>Restaurar dados</span></button>
        <Link href="/" prefetch={false} onClick={mode.exit} title="Sair da demonstração" aria-label="Sair da demonstração"><Icon name="logout" size={16}/><span>Sair</span></Link>
      </div>
    </div></div>
    <dialog ref={dialog} className="dialog" aria-labelledby="demo-reset-title" aria-describedby="demo-reset-description" onCancel={event => { if (pending) event.preventDefault(); else setOpen(false); }} onClick={event => { if (event.target === event.currentTarget && !pending) setOpen(false); }}>
      <span className="dialog-icon"><Icon name="restore" size={24}/></span>
      <h2 id="demo-reset-title">Restaurar a demonstração?</h2>
      <p id="demo-reset-description">Todos os projetos que você criou, as imagens enviadas e as alterações feitas nesta demonstração serão perdidos. Os dois projetos iniciais serão restaurados. Essa ação não pode ser desfeita.</p>
      <div className="dialog-actions"><button type="button" className="button button-outline" autoFocus disabled={pending} onClick={() => setOpen(false)}>Cancelar</button><button type="button" className="button button-danger" disabled={pending} onClick={restore}>{pending ? "Restaurando…" : "Restaurar dados"}</button></div>
    </dialog>
  </>;
}
