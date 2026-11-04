"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./icon";
import { FieldError } from "./form-feedback";
import { ProjectDescription } from "./project-description";

const tools: { icon: IconName; label: string; prefix: string; suffix?: string; placeholder: string }[] = [
  { icon: "bold", label: "Negrito", prefix: "**", suffix: "**", placeholder: "texto" },
  { icon: "italic", label: "Itálico", prefix: "*", suffix: "*", placeholder: "texto" },
  { icon: "heading", label: "Subtítulo", prefix: "### ", placeholder: "Subtítulo" },
  { icon: "list", label: "Lista", prefix: "- ", placeholder: "Item" },
  { icon: "list-ordered", label: "Lista numerada", prefix: "1. ", placeholder: "Item" },
  { icon: "quote", label: "Citação", prefix: "> ", placeholder: "Citação" },
  { icon: "code", label: "Bloco de código", prefix: "```\n", suffix: "\n```", placeholder: "código" },
  { icon: "link", label: "Link", prefix: "[", suffix: "](https://exemplo.com)", placeholder: "texto do link" },
];

export function DescriptionEditor({ value, onChange, error, preview, onPreviewChange }: {
  value: string; onChange: (value: string) => void; error?: string;
  preview: boolean; onPreviewChange: (value: boolean) => void;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const [formatError, setFormatError] = useState("");
  const id = "project-description";
  function switchMode(event: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? false : event.key === "End" ? true : !preview;
    onPreviewChange(next);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-mode="${next ? "preview" : "write"}"]`)?.focus();
  }
  function format(tool: typeof tools[number]) {
    const textarea = input.current;
    if (!textarea) return;
    const start = textarea.selectionStart, end = textarea.selectionEnd;
    const selected = value.slice(start, end) || tool.placeholder;
    const block = !["bold", "italic", "link"].includes(tool.icon);
    const before = block && start > 0 && value[start - 1] !== "\n" ? "\n\n" : "";
    const after = block && end < value.length && value[end] !== "\n" ? "\n\n" : "";
    const content = !tool.suffix ? selected.split("\n").map((line, index) => `${tool.icon === "list-ordered" ? `${index + 1}. ` : tool.prefix}${line}`).join("\n") : `${tool.prefix}${selected}${tool.suffix}`;
    const next = value.slice(0, start) + before + content + after + value.slice(end);
    if (next.length > 6000) { setFormatError("A descrição deve ter até 6.000 caracteres, incluindo a formatação."); return; }
    setFormatError(""); onChange(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + before.length + tool.prefix.length;
      if (tool.icon === "link") {
        const urlStart = start + before.length + content.indexOf("https://exemplo.com");
        textarea.setSelectionRange(urlStart, urlStart + "https://exemplo.com".length);
      } else textarea.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  }
  return <div className="form-field description-field">
    <div className="field-label-row"><label htmlFor={id}>Descrição <span className="required-dot">*</span></label><span>{value.length}/6000</span></div>
    <div className="description-editor" data-invalid={!!error}>
      <div className="description-tabs" role="tablist" aria-label="Modo da descrição">
        {([false, true] as const).map(isPreview => <button key={String(isPreview)} id={`${id}-${isPreview ? "preview" : "write"}-tab`} type="button" role="tab"
          data-mode={isPreview ? "preview" : "write"} aria-selected={preview === isPreview} tabIndex={preview === isPreview ? 0 : -1}
          aria-controls={`${id}-${isPreview ? "preview" : "write"}-panel`} onKeyDown={switchMode} onClick={() => onPreviewChange(isPreview)}>
          {isPreview ? "Prévia" : "Escrever"}
        </button>)}
      </div>
      <div id={`${id}-write-panel`} role="tabpanel" aria-labelledby={`${id}-write-tab`} hidden={preview}>
        <div className="description-tools" role="group" aria-label="Formatação da descrição">
          {tools.map(tool => <button key={tool.icon} type="button" aria-label={tool.label} title={tool.label} onClick={() => format(tool)}><Icon name={tool.icon} size={18}/></button>)}
        </div>
        <textarea ref={input} id={id} name="description" aria-invalid={!!error} aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`} value={value}
          onChange={event => { setFormatError(""); onChange(event.target.value); }} required minLength={30} maxLength={6000} rows={8}/>
      </div>
      <div id={`${id}-preview-panel`} className="description-preview" role="tabpanel" aria-labelledby={`${id}-preview-tab`} hidden={!preview} tabIndex={0}>
        {preview && (value.trim() ? <ProjectDescription headingLevel={2}>{value}</ProjectDescription> : <p className="description-empty">A prévia da descrição aparecerá aqui.</p>)}
      </div>
    </div>
    <FieldError id={`${id}-error`} text={error}/>
    {formatError && <p className="field-error" role="status">{formatError}</p>}
    <small id={`${id}-help`}>Conte o que o projeto faz e como foi desenvolvido. De 30 a 6.000 caracteres. Aceita Markdown.</small>
  </div>;
}
