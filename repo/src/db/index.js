import { getDb, withTransaction } from "./client";
import { createRepository } from "./repository";
import { COLLECTIONS } from "./schema";

export function createDbContext() {
  return {
    async init() {
      await getDb();
    },
    transaction(storeNames, mode, operation) {
      return withTransaction(storeNames, mode, operation);
    },
    collections: Object.fromEntries(
      Object.values(COLLECTIONS).map((collectionName) => [
        collectionName,
        createRepository(collectionName),
      ]),
    ),
  };
}

export { COLLECTIONS };
