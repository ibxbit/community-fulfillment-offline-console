import { fail, ok } from "./response";

export function createBaseService(repository, options = {}) {
  const { auditTrail, resourceType = "resource" } = options;

  return {
    async list(query = {}, options = {}) {
      const items = await repository.findMany(query, options);
      return ok(items);
    },

    async getById(id) {
      const item = await repository.findOne({ _id: id });
      if (!item) {
        return fail("Not found", 404);
      }

      return ok(item);
    },

    async create(payload) {
      const created = await repository.insertOne(payload);

      if (auditTrail) {
        await auditTrail.append({
          action: "create",
          resourceType,
          resourceId: created._id,
        });
      }

      return ok(created, 201);
    },

    async updateById(id, patch) {
      const updated = await repository.updateOne({ _id: id }, patch);
      if (!updated) {
        return fail("Not found", 404);
      }

      if (auditTrail) {
        await auditTrail.append({
          action: "update",
          resourceType,
          resourceId: updated._id,
          metadata: { patchKeys: Object.keys(patch ?? {}) },
        });
      }

      return ok(updated);
    },

    async deleteById(id) {
      const deleted = await repository.deleteOne({ _id: id });
      if (!deleted) {
        return fail("Not found", 404);
      }

      return ok({ deleted: true });
    },
  };
}
