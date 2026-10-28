"use client";

import { useId, useRef, useState } from "react";
import { COVER_MAX_ZOOM, DEFAULT_COVER_FRAMING, type CoverFraming } from "@/lib/cover-framing";
import { Icon } from "./icon";
import { ProjectCover } from "./project-cover";

export function CoverFramingEditor({ title, style, imageUrl, isFinal, value, onChange, disabled = false }: {
  title: string; style: string; imageUrl: string; isFinal: boolean;
  value: CoverFraming | null; onChange: (value: CoverFraming | null) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<"card" | "detail">("card");
  const [imageStatus, setImageStatus] = useState<"loading" | "ready" | "error">("loading");
  const original = useRef<CoverFraming | null>(value);
  const trigger = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLFieldSetElement>(null);
  const id = useId();
  const frame = value || DEFAULT_COVER_FRAMING;
  function finish(cancel = false) {
    if (cancel) onChange(original.current);
    setEditing(false);
    requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }));
  }
  return <fieldset ref={root} className="cover-preview" disabled={disabled} onKeyDown={event => {
    if (editing && event.key === "Escape") { event.preventDefault(); finish(true); }
  }}>
    <legend className="sr-only">Enquadramento da capa</legend>
    {imageUrl && <div className="cover-preview-modes" role="group" aria-label="Formato da prévia">
      <button type="button" aria-pressed={mode === "card"} onClick={() => setMode("card")}>Cartão</button>
      <button type="button" aria-pressed={mode === "detail"} onClick={() => setMode("detail")}>Página</button>
    </div>}
    <ProjectCover title={title} style={style} imageUrl={imageUrl} isFinal={isFinal} framing={value} fullSize
      className={imageUrl && mode === "detail" ? "cover-preview-detail" : ""}
      onFramingChange={editing && !disabled ? onChange : undefined} cropHelpId={`${id}-help`} onImageStatusChange={setImageStatus}/>
    {imageUrl && (editing ? <div className="cover-framing-controls">
      <p id={`${id}-help`}>Arraste a imagem ou use as setas. O ajuste vale para os dois formatos.</p>
      <div className="cover-zoom-label"><label htmlFor={`${id}-zoom`}>Zoom <output>{Math.round(frame.zoom * 100)}%</output></label>
        <button type="button" className="cover-framing-reset" onClick={() => onChange({ ...DEFAULT_COVER_FRAMING })}><Icon name="restore" size={14}/>Redefinir</button>
      </div>
      <input id={`${id}-zoom`} type="range" min={1} max={COVER_MAX_ZOOM} step={.01} value={frame.zoom}
        aria-valuetext={`${Math.round(frame.zoom * 100)}%`} onChange={event => onChange({ ...frame, zoom: Number(event.target.value) })}/>
      <div className="cover-framing-actions">
        <button type="button" className="button button-outline" onClick={() => finish(true)}>Cancelar</button>
        <button type="button" className="button button-dark" onClick={() => finish()}>Concluir</button>
      </div>
    </div> : <button ref={trigger} type="button" className="button button-outline cover-framing-trigger" disabled={imageStatus !== "ready"} onClick={() => {
      original.current = value; setEditing(true);
      requestAnimationFrame(() => root.current?.querySelector<HTMLButtonElement>(".cover-crop-surface")?.focus({ preventScroll: true }));
    }}><Icon name="sliders" size={16}/>Ajustar enquadramento</button>)}
    {imageUrl && imageStatus === "error" && <p className="cover-framing-error" role="status">Não foi possível carregar a imagem para ajustar o enquadramento.</p>}
  </fieldset>;
}
