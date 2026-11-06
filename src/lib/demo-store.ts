import { initialDemo, demoPerson, type DemoWorkspace, type DemoProject } from "./demo-data";
import type { ProjectFormValues } from "./projects-client";
import { validateProject } from "./validation";
import { validateImageFile } from "./image-policy";

const DATABASE = "toti-gallery-demo";
const STORE = "workspace";
const KEY = "current";
const unavailable = "Não foi possível abrir a demonstração. Permita o armazenamento neste navegador e tente novamente.";
const failedSave = "Não foi possível salvar neste navegador. O armazenamento pode estar cheio ou indisponível. Seus dados continuam no formulário.";

async function openDatabase(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error(unavailable)); return; }
    const request = indexedDB.open(DATABASE, 1);
    let settled = false;
    const fail = () => { settled = true; reject(new Error(unavailable)); };
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = fail;
    request.onblocked = fail;
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  }).catch(() => { throw new Error(unavailable); });
}

/** One record/transaction keeps records and image Blobs atomic, including reset. */
async function changeWorkspace(change: (current: DemoWorkspace | undefined) => DemoWorkspace): Promise<DemoWorkspace> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      let result: DemoWorkspace;
      let failure: unknown;
      const request = store.get(KEY);
      request.onsuccess = () => {
        try {
          const current = request.result as DemoWorkspace | undefined;
          if (current && (current.schemaVersion !== 1 || !Array.isArray(current.projects) || typeof current.generation !== "string")) throw new Error("Os dados desta demonstração não são compatíveis. Use Restaurar dados para recomeçar.");
          result = change(current);
          if (result !== current) store.put(result, KEY);
        } catch (error) { failure = error instanceof DOMException ? new Error(failedSave) : error; tx.abort(); }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || new Error(failedSave));
      tx.onerror = () => { /* onabort reports the safe error after rollback. */ };
    });
  } finally { database.close(); }
}

export const loadDemo = () => changeWorkspace(current => current ?? initialDemo());
// Reset can replace incompatible local records too; no other DB/store is touched.
export async function resetDemo(): Promise<DemoWorkspace> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const next = initialDemo();
      const tx = database.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(next, KEY);
      tx.oncomplete = () => resolve(next);
      tx.onabort = () => reject(new Error(failedSave));
      tx.onerror = () => {};
    });
  } finally { database.close(); }
}

function requireCurrent(current: DemoWorkspace | undefined, generation: string) {
  if (!current || current.generation !== generation) throw new Error("A demonstração foi restaurada em outra aba. Atualize a página antes de continuar.");
  return current;
}

export async function saveDemoProject(generation: string, id: string, values: ProjectFormValues, expectedVersion?: number, file?: File | null) {
  if (file) validateImageFile(file);
  // Blob URLs are presentation-only; neither URLs nor real author/turma IDs persist.
  const data = validateProject({ ...values, imageUrl: "", turmaId: demoPerson.turmaId });
  const image = file ? new Blob([await file.arrayBuffer()], { type: file.type }) : null;
  return changeWorkspace(current => {
    const workspace = requireCurrent(current, generation);
    const previous = workspace.projects.find(project => project.id === id);
    if (expectedVersion !== undefined && (!previous || previous.version !== expectedVersion)) throw new Error("Este projeto mudou ou foi excluído em outra aba. Reabra a versão atual antes de salvar. Suas alterações continuam no formulário.");
    // A repeated local create keeps the same ID rather than adding a duplicate.
    if (expectedVersion === undefined && previous) return workspace;
    const project: DemoProject = {
      ...data, id, slug: id, version: (previous?.version ?? 0) + 1,
      turmaId: demoPerson.turmaId!, createdAt: previous?.createdAt ?? new Date().toISOString(),
      image: image ?? (values.imageUrl ? previous?.image ?? null : null),
      featured: false, likes: 0, liked: false, visibility: "published",
    };
    return { ...workspace, projects: [project, ...workspace.projects.filter(item => item.id !== id)] };
  });
}

export function deleteDemoProject(generation: string, id: string) {
  return changeWorkspace(current => {
    const workspace = requireCurrent(current, generation);
    return { ...workspace, projects: workspace.projects.filter(project => project.id !== id) };
  });
}
