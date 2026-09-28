"use client";

// Offline mutation queue using IndexedDB
// Queues mutations when offline and syncs when back online

const DB_NAME = "school-offline-queue";
const STORE_NAME = "mutations";

type QueuedMutation = {
  id: string;
  table: string;
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body: string;
  timestamp: number;
  synced: boolean;
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

export async function queueMutation(mutation: Omit<QueuedMutation, "id" | "timestamp" | "synced">): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const item: QueuedMutation = {
    ...mutation,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    synced: false,
  };
  await new Promise<void>((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getPendingMutations(): Promise<QueuedMutation[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const items = (request.result as QueuedMutation[]).filter((m) => !m.synced);
      resolve(items.sort((a, b) => a.timestamp - b.timestamp));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function markMutationSynced(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function syncPendingMutations(
  onProgress: (synced: number, total: number) => void,
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingMutations();
  let synced = 0;
  let failed = 0;

  for (const mutation of pending) {
    try {
      const { supabaseRequest } = await import("@/lib/supabase");
      await supabaseRequest(mutation.path, {
        method: mutation.method,
        headers: { "Content-Type": "application/json" },
        body: mutation.body,
      });
      await markMutationSynced(mutation.id);
      synced++;
    } catch {
      failed++;
    }
    onProgress(synced + failed, pending.length);
  }

  return { synced, failed };
}
