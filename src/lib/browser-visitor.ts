import { requestJson } from "./http-client";
import { isVisitorId } from "./visitor-id";

let ready: Promise<void> | undefined;

/** A read/write transaction makes first-time identity creation atomic across tabs. */
async function storedVisitor(preferred?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("toti-gallery", 1);
    open.onupgradeneeded = () => { open.result.createObjectStore("visitor"); };
    open.onerror = () => reject(new Error("Não foi possível acessar o armazenamento do navegador."));
    open.onblocked = () => reject(new Error("Feche outras abas antigas e tente novamente."));
    open.onsuccess = () => {
      const database = open.result;
      database.onversionchange = () => database.close();
      const failed = () => { database.close(); reject(new Error("Não foi possível guardar a identificação do navegador.")); };
      try {
        const tx = database.transaction("visitor", "readwrite");
        const store = tx.objectStore("visitor"), read = store.get("id");
        let id: string;
        read.onsuccess = () => {
          try { id = preferred || (isVisitorId(read.result) ? read.result : crypto.randomUUID()); store.put(id, "id"); }
          catch { tx.abort(); }
        };
        tx.oncomplete = () => { database.close(); resolve(id); };
        tx.onabort = tx.onerror = failed;
      } catch { failed(); }
    };
  });
}
async function prepare(visitorId?: string) {
  const data = await requestJson("/api/visitor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(visitorId ? { visitorId } : {}), cache: "no-store" }, "Não foi possível preparar as curtidas.");
  if (!isVisitorId(data.visitorId)) throw new Error("Não foi possível preparar as curtidas.");
  return data.visitorId;
}
export function ensureBrowserVisitor() {
  ready ??= (async () => {
    let id: string;
    try { id = await storedVisitor(); }
    catch {
      // Cookie-only fallback still serializes first setup across tabs where supported.
      if (typeof navigator !== "undefined" && navigator.locks) {
        await navigator.locks.request("toti-visitor", () => prepare()); return;
      }
      throw new Error("Permita cookies e armazenamento no navegador para curtir.");
    }
    const canonical = await prepare(id);
    if (canonical !== id) await storedVisitor(canonical);
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}
