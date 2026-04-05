import { fail, ok } from "./response";

function hasRequiredDraftFields(payload) {
  return Boolean(
    payload &&
      payload.requestingOrgId &&
      payload.requestingClassId &&
      payload.itemSku &&
      payload.quantity,
  );
}

export function createRequestService({ requestLifecycle, requestsRepository }) {
  return {
    async list({ filter = {}, options = {} } = {}) {
      const items = await requestsRepository.find(filter, options);
      return ok(items);
    },

    async create({ actor, payload }) {
      if (!actor?.userId) {
        return fail("actor.userId is required", 400);
      }

      if (!hasRequiredDraftFields(payload)) {
        return fail(
          "requestingOrgId, requestingClassId, itemSku, quantity are required",
          400,
        );
      }

      return requestLifecycle.createDraft(actor, payload);
    },

    async update({ actor, requestId, patch }) {
      if (!actor?.userId) {
        return fail("actor.userId is required", 400);
      }

      if (!requestId) {
        return fail("requestId is required", 400);
      }

      if (!patch || Object.keys(patch).length === 0) {
        return fail("patch is required", 400);
      }

      return requestLifecycle.editDraft(actor, requestId, patch);
    },

    async submit({ actor, requestId }) {
      if (!actor?.userId) {
        return fail("actor.userId is required", 400);
      }

      if (!requestId) {
        return fail("requestId is required", 400);
      }

      return requestLifecycle.submitForReview(actor, requestId);
    },

    async archive({ actor, requestId }) {
      if (!actor?.userId) {
        return fail("actor.userId is required", 400);
      }

      if (!requestId) {
        return fail("requestId is required", 400);
      }

      return requestLifecycle.archive(actor, requestId);
    },
  };
}
