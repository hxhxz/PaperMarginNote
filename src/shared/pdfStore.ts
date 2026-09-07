import type { ParsedPaper } from './types';

const DB_NAME = 'article-read-pdf';
const STORE_NAME = 'papers';

function openDb(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'paperId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getParsedPaper(paperId: string): Promise<ParsedPaper | undefined> {
  const db = await openDb();
  return new Promise<ParsedPaper | undefined>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(paperId);
    request.onsuccess = () => resolve(request.result as ParsedPaper | undefined);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export async function putParsedPaper(paper: ParsedPaper): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(paper);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}
