/** ─── Writing the .vey file ───────────────────────────────────────────────────
 *  Edge and Chrome (File System Access API): the same file is rewritten.
 *  Elsewhere: a download, as before. The file handle is remembered in the
 *  browser and tied to one package, so another perimeter never overwrites it.
 */

interface Writable { write(data: string): Promise<void>; close(): Promise<void> }
export interface VeyHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
  queryPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
}
type PickerOptions = { suggestedName?: string; types: { description: string; accept: Record<string, string[]> }[] };
type PickerWindow = Window & {
  showSaveFilePicker?: (o: PickerOptions) => Promise<VeyHandle>;
  showOpenFilePicker?: (o: PickerOptions) => Promise<VeyHandle[]>;
};

/** The file on disk, as last read or written by the app. */
export interface Link { handle: VeyHandle; owner: string; modified: number }

const TYPES = [{ description: "Food Risk Intelligence", accept: { "application/json": [".vey"] } }];
const win = () => window as PickerWindow;

export const canRewriteFile = () => typeof window !== "undefined" && !!win().showSaveFilePicker;

const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

/* ── remembered link (IndexedDB can store file handles; localStorage cannot) ── */

const DB = "fri-perimetre";
const STORE = "file";

function withStore<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open(DB, 1);
      open.onupgradeneeded = () => { open.result.createObjectStore(STORE); };
      open.onerror = () => resolve(undefined);
      open.onsuccess = () => {
        try {
          const tx = open.result.transaction(STORE, mode);
          const req = run(tx.objectStore(STORE));
          tx.oncomplete = () => { open.result.close(); resolve(req.result); };
          tx.onerror = tx.onabort = () => { open.result.close(); resolve(undefined); };
        } catch {
          // A handle the browser cannot store: the file is simply asked again next time.
          open.result.close();
          resolve(undefined);
        }
      };
    } catch {
      resolve(undefined);
    }
  });
}

export const recallLink = () => withStore<Link>("readonly", (s) => s.get("link"));
const keepLink = (link: Link) => withStore("readwrite", (s) => s.put(link, "link"));
export const forgetLink = () => withStore("readwrite", (s) => s.delete("link"));

export async function rememberLink(handle: VeyHandle, owner: string): Promise<Link> {
  const link = { handle, owner, modified: (await handle.getFile()).lastModified };
  await keepLink(link);
  return link;
}

/* ── open and write ──────────────────────────────────────────────────────────── */

/** `null` when the user closed the picker. */
export async function pickFile(): Promise<{ handle: VeyHandle; file: File } | null> {
  try {
    const [handle] = await win().showOpenFilePicker!({ types: TYPES });
    return { handle, file: await handle.getFile() };
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

export type WriteResult =
  | { kind: "written"; link: Link }
  | { kind: "cancelled" }
  /** No file access here (embedded page, blocked): the caller downloads instead. */
  | { kind: "unsupported" }
  | { kind: "failed" };

/** Must be called from a click: the browser only grants access on a user gesture. */
export async function writeFile(opts: {
  link: Link | null;
  owner: string;
  suggestedName: string;
  content: string;
  /** Asked when the file changed on disk since the app last saw it. */
  confirmOverwrite: (name: string) => boolean;
}): Promise<WriteResult> {
  if (!canRewriteFile()) return { kind: "unsupported" };
  let handle = opts.link && opts.link.owner === opts.owner ? opts.link.handle : null;
  try {
    if (handle) {
      const mode = { mode: "readwrite" as const };
      let state = (await handle.queryPermission?.(mode)) ?? "granted";
      if (state !== "granted") state = (await handle.requestPermission?.(mode)) ?? "denied";
      if (state !== "granted") return { kind: "cancelled" };
      let modified: number | null = null;
      try { modified = (await handle.getFile()).lastModified; } catch { handle = null; /* moved or deleted */ }
      if (handle && modified !== opts.link!.modified && !opts.confirmOverwrite(handle.name)) return { kind: "cancelled" };
    }
    if (!handle) handle = await win().showSaveFilePicker!({ suggestedName: opts.suggestedName, types: TYPES });
  } catch (e) {
    if (isAbort(e)) return { kind: "cancelled" };
    return { kind: "unsupported" };
  }
  try {
    const out = await handle.createWritable();
    await out.write(opts.content);
    await out.close();
    return { kind: "written", link: await rememberLink(handle, opts.owner) };
  } catch {
    return { kind: "failed" };
  }
}
