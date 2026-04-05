import { requestToPromise, withStore, withTransaction } from "./client";
import { applyQueryOptions, matchesQuery } from "./query";
import { createId } from "../utils/id";

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function prepareDocument(collectionName, document) {
  const now = new Date().toISOString();

  return {
    _id: document._id ?? createId(collectionName),
    createdAt: document.createdAt ?? now,
    updatedAt: now,
    ...cloneJson(document),
  };
}

export function createRepository(collectionName) {
  async function loadAll() {
    return withStore(collectionName, "readonly", (store) =>
      requestToPromise(store.getAll()),
    );
  }

  async function loadByIndexedFilter(filter = {}) {
    const directCandidates = ["sku", "requester", "date", "status"];

    for (const field of directCandidates) {
      const value = filter[field];
      const isPrimitive =
        value !== undefined &&
        value !== null &&
        (typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean");

      if (!isPrimitive) {
        continue;
      }

      try {
        return withStore(collectionName, "readonly", (store) =>
          requestToPromise(store.index(`idx_${field}`).getAll(value)),
        );
      } catch {
        return null;
      }
    }

    return null;
  }

  return {
    async insertOne(document) {
      const next = prepareDocument(collectionName, document);
      await withStore(collectionName, "readwrite", (store) =>
        requestToPromise(store.put(next)),
      );
      return cloneJson(next);
    },

    async insertMany(documents = []) {
      const nextDocs = documents.map((doc) =>
        prepareDocument(collectionName, doc),
      );

      await withTransaction(collectionName, "readwrite", async (stores) => {
        await Promise.all(
          nextDocs.map((doc) =>
            requestToPromise(stores[collectionName].put(doc)),
          ),
        );
      });

      return cloneJson(nextDocs);
    },

    async find(filter = {}, options = {}) {
      const indexedDocs = await loadByIndexedFilter(filter);
      const docs = indexedDocs ?? (await loadAll());
      const matched = docs.filter((doc) => matchesQuery(doc, filter));
      return cloneJson(applyQueryOptions(matched, options));
    },

    async findOne(filter = {}, options = {}) {
      const items = await this.find(filter, { ...options, limit: 1 });
      return items[0] ?? null;
    },

    async updateOne(filter, patch) {
      const doc = await this.findOne(filter);
      if (!doc) {
        return null;
      }

      const next = {
        ...doc,
        ...cloneJson(patch),
        updatedAt: new Date().toISOString(),
      };

      await withStore(collectionName, "readwrite", (store) =>
        requestToPromise(store.put(next)),
      );
      return cloneJson(next);
    },

    async updateMany(filter = {}, patch = {}) {
      const docs = await this.find(filter);
      if (docs.length === 0) {
        return [];
      }

      const nextDocs = docs.map((doc) => ({
        ...doc,
        ...cloneJson(patch),
        updatedAt: new Date().toISOString(),
      }));

      await withTransaction(collectionName, "readwrite", async (stores) => {
        await Promise.all(
          nextDocs.map((doc) =>
            requestToPromise(stores[collectionName].put(doc)),
          ),
        );
      });

      return cloneJson(nextDocs);
    },

    async deleteOne(filter) {
      const doc = await this.findOne(filter);
      if (!doc) {
        return false;
      }

      await withStore(collectionName, "readwrite", (store) =>
        requestToPromise(store.delete(doc._id)),
      );
      return true;
    },

    async deleteMany(filter = {}) {
      const docs = await this.find(filter);
      if (docs.length === 0) {
        return 0;
      }

      await withTransaction(collectionName, "readwrite", async (stores) => {
        await Promise.all(
          docs.map((doc) =>
            requestToPromise(stores[collectionName].delete(doc._id)),
          ),
        );
      });

      return docs.length;
    },

    async countDocuments(filter = {}) {
      const docs = await this.find(filter);
      return docs.length;
    },

    // Backward-compatible aliases for existing scaffold.
    async findMany(filter = {}, options = {}) {
      return this.find(filter, options);
    },
  };
}
