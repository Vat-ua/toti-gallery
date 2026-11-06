// Only an opaque request ID is persisted, never form values or images.
export function creationAttempt(ownerId: string, fallback: string): string {
  const key = `toti:project-creation:${ownerId}`;
  try {
    const stored = sessionStorage.getItem(key);
    if (stored && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored)) return stored;
    sessionStorage.setItem(key, fallback);
  } catch { /* Private/blocked storage: the editor retains its in-memory ID. */ }
  return fallback;
}

export function finishCreationAttempt(ownerId: string, requestId: string) {
  try {
    const key = `toti:project-creation:${ownerId}`;
    if (sessionStorage.getItem(key) === requestId) sessionStorage.removeItem(key);
  } catch { /* Saving does not depend on browser storage. */ }
}
