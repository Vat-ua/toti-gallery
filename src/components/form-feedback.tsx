"use client";

import { useState } from "react";
import { FormValidationError, type FieldErrors } from "@/lib/form-validation";

export function focusFirstError(form: HTMLFormElement | null, errors: FieldErrors) {
  // Wait for React to render feedback and re-enable a fieldset after a request.
  requestAnimationFrame(() => {
    if (!form?.isConnected) return;
    const field = Array.from(form.querySelectorAll<HTMLElement>("[name], [data-field]"))
      .find(node => errors[node.getAttribute("name") || node.dataset.field || ""]);
    const target = field?.matches("input:not([type=hidden]), select, textarea, button, [tabindex]")
      ? field : field?.querySelector<HTMLElement>("button, input:not([type=hidden]), select, textarea");
    target?.focus();
  });
}

export function useFormFeedback() {
  const [fields, setFields] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  function report(value: unknown, form?: HTMLFormElement) {
    if (value instanceof FormValidationError) {
      setFields(value.fieldErrors); setError(""); focusFirstError(form ?? null, value.fieldErrors);
    } else {
      setError(value instanceof TypeError ? "Confira sua conexão e tente novamente." : value instanceof Error ? value.message : "Não foi possível salvar. Tente novamente.");
    }
  }
  function clear(name: string) { setFields(current => ({ ...current, [name]: undefined })); setError(""); }
  function reset() { setFields({}); setError(""); }
  function validate(check: () => unknown, form: HTMLFormElement) {
    reset();
    try { check(); return true; } catch (error) { report(error, form); return false; }
  }
  return { fields, error, report, clear, reset, validate };
}

export function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} className="field-error" role="alert">{text}</p> : null;
}
