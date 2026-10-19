/**
 * Écriture directe d'un fichier du webroot depuis le navigateur.
 *
 * L'API d'Eco ne permet pas d'écrire un fichier arbitraire sur le serveur. Quand le
 * panel est administré depuis la machine qui héberge le serveur (ou un partage
 * réseau), l'API File System Access permet à l'administrateur d'autoriser **une
 * fois** l'accès à `WebBin/annonces.json` : les publications suivantes écrivent
 * ensuite directement dans le fichier, sans téléchargement ni copie manuelle.
 *
 * La permission est mémorisée par le navigateur (poignée conservée dans IndexedDB) ;
 * Chrome et Edge la redemandent d'un clic après un redémarrage du navigateur.
 */

const DB_NAME = 'agora';
const STORE = 'poignees';

export function isDirectWriteSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const request = run(db.transaction(STORE, mode).objectStore(STORE));
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function loadHandle(key: string): Promise<FileSystemFileHandle | null> {
  return withStore<FileSystemFileHandle>('readonly', (store) => store.get(key));
}

export async function saveHandle(key: string, handle: FileSystemFileHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, key));
}

export async function forgetHandle(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key));
}

/** Demande (ou vérifie) l'autorisation d'écriture sur une poignée existante. */
export async function ensureWritable(handle: FileSystemFileHandle): Promise<boolean> {
  const options = { mode: 'readwrite' as const };
  type Permissive = FileSystemFileHandle & {
    queryPermission?: (o: unknown) => Promise<PermissionState>;
    requestPermission?: (o: unknown) => Promise<PermissionState>;
  };
  const h = handle as Permissive;
  if ((await h.queryPermission?.(options)) === 'granted') return true;
  return (await h.requestPermission?.(options)) === 'granted';
}

/** Ouvre le sélecteur de fichier et renvoie la poignée choisie. */
export async function chooseFile(suggestedName: string): Promise<FileSystemFileHandle | null> {
  const picker = (window as unknown as {
    showSaveFilePicker?: (o: unknown) => Promise<FileSystemFileHandle>;
  }).showSaveFilePicker;
  if (!picker) return null;
  try {
    return await picker({
      suggestedName,
      types: [{ description: 'Fichier JSON', accept: { 'application/json': ['.json'] } }],
    });
  } catch {
    // L'utilisateur a annulé le sélecteur.
    return null;
  }
}

/** Écrit le contenu dans le fichier pointé par la poignée. */
export async function writeToHandle(handle: FileSystemFileHandle, content: string): Promise<void> {
  const stream = await handle.createWritable();
  await stream.write(content);
  await stream.close();
}
