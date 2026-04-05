import { DB_NAME, DB_VERSION, SCHEMA } from "./schema";

let dbPromise;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      for (const collection of SCHEMA) {
        let store;

        if (!db.objectStoreNames.contains(collection.name)) {
          store = db.createObjectStore(collection.name, {
            keyPath: collection.keyPath,
          });
        } else {
          store = request.transaction.objectStore(collection.name);
        }

        for (const index of collection.indexes ?? []) {
          if (!store.indexNames.contains(index.name)) {
            store.createIndex(index.name, index.keyPath, index.options);
          }
        }
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDb();
  }

  return dbPromise;
}

export async function withStore(storeName, mode, operation) {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;

    try {
      result = operation(store, tx);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }

    tx.oncomplete = async () => {
      try {
        resolve(await result);
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function withTransaction(storeNames, mode, operation) {
  const db = await getDb();

  return new Promise((resolve, reject) => {
    const names = Array.isArray(storeNames) ? storeNames : [storeNames];
    const tx = db.transaction(names, mode);
    const stores = Object.fromEntries(
      names.map((name) => [name, tx.objectStore(name)]),
    );
    let result;

    try {
      result = operation(stores, tx);
    } catch (error) {
      tx.abort();
      reject(error);
      return;
    }

    tx.oncomplete = async () => {
      try {
        resolve(await result);
      } catch (error) {
        reject(error);
      }
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
