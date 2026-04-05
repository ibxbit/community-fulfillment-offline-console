import { fail, ok } from "./response";
import { createId } from "../utils/id";

const DEDUPE_WINDOW_MS = 60 * 1000;

const PRIORITY_WEIGHT = {
  high: 3,
  normal: 2,
  low: 1,
};

function nowIso() {
  return new Date().toISOString();
}

function interpolate(template, variables) {
  return String(template).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = variables?.[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function priorityValue(priority) {
  return PRIORITY_WEIGHT[priority] ?? PRIORITY_WEIGHT.normal;
}

function canonicalData(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalData(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${key}:${canonicalData(value[key])}`).join(",")}}`;
  }

  return String(value ?? "");
}

function dedupeFingerprint({
  recipientUserId,
  templateId,
  variables,
  title,
  body,
}) {
  return canonicalData({ recipientUserId, templateId, variables, title, body });
}

export function createInAppMessagingService(repository) {
  return {
    async upsertTemplate(payload) {
      const templateId = String(payload?.templateId ?? "").trim();
      const title = String(payload?.title ?? "").trim();
      const body = String(payload?.body ?? "").trim();

      if (!templateId || !title || !body) {
        return fail("templateId, title, and body are required", 400);
      }

      const next = {
        _id: `template_${templateId}`,
        kind: "template",
        templateId,
        title,
        body,
        variables: Array.isArray(payload?.variables) ? payload.variables : [],
        defaultPriority: payload?.defaultPriority ?? "normal",
        updatedAt: nowIso(),
      };

      const existing = await repository.findOne({ _id: next._id });
      const saved = existing
        ? await repository.updateOne(
            { _id: next._id },
            { ...existing, ...next },
          )
        : await repository.insertOne(next);

      return ok(saved, existing ? 200 : 201);
    },

    async listTemplates() {
      const items = await repository.find(
        { kind: "template" },
        { sort: { templateId: 1 } },
      );
      return ok(items);
    },

    async setSubscriptionPreferences(userId, preferences) {
      const normalizedUserId = String(userId ?? "").trim();
      if (!normalizedUserId) {
        return fail("userId is required", 400);
      }

      const next = {
        _id: `subscription_${normalizedUserId}`,
        kind: "subscription",
        userId: normalizedUserId,
        preferences: {
          mutedTemplateIds: preferences?.mutedTemplateIds ?? [],
          mutedPriorities: preferences?.mutedPriorities ?? [],
          allowAll: preferences?.allowAll !== false,
        },
        updatedAt: nowIso(),
      };

      const existing = await repository.findOne({ _id: next._id });
      const saved = existing
        ? await repository.updateOne(
            { _id: next._id },
            { ...existing, ...next },
          )
        : await repository.insertOne(next);

      return ok(saved, existing ? 200 : 201);
    },

    async getSubscriptionPreferences(userId) {
      const normalizedUserId = String(userId ?? "").trim();
      if (!normalizedUserId) {
        return fail("userId is required", 400);
      }

      const existing = await repository.findOne({
        _id: `subscription_${normalizedUserId}`,
      });
      return ok(
        existing ?? {
          _id: `subscription_${normalizedUserId}`,
          kind: "subscription",
          userId: normalizedUserId,
          preferences: {
            mutedTemplateIds: [],
            mutedPriorities: [],
            allowAll: true,
          },
        },
      );
    },

    async queueMessage(payload) {
      const recipientUserId = String(payload?.recipientUserId ?? "").trim();
      if (!recipientUserId) {
        return fail("recipientUserId is required", 400);
      }

      let title = String(payload?.title ?? "").trim();
      let body = String(payload?.body ?? "").trim();
      const templateId = payload?.templateId
        ? String(payload.templateId).trim()
        : null;
      const variables = payload?.variables ?? {};

      if (templateId) {
        const template = await repository.findOne({
          _id: `template_${templateId}`,
          kind: "template",
        });
        if (!template) {
          return fail("Template not found", 404);
        }

        title = interpolate(template.title, variables);
        body = interpolate(template.body, variables);
      }

      if (!title || !body) {
        return fail("title/body (or valid template) is required", 400);
      }

      const priority = payload?.priority ?? "normal";
      const subscriptionResult =
        await this.getSubscriptionPreferences(recipientUserId);
      const subscription = subscriptionResult.data.preferences;

      if (!subscription.allowAll) {
        return ok({ skipped: true, reason: "user_subscriptions_blocked" }, 202);
      }

      if (templateId && subscription.mutedTemplateIds.includes(templateId)) {
        return ok({ skipped: true, reason: "template_muted" }, 202);
      }

      if (subscription.mutedPriorities.includes(priority)) {
        return ok({ skipped: true, reason: "priority_muted" }, 202);
      }

      const fingerprint = dedupeFingerprint({
        recipientUserId,
        templateId,
        variables,
        title,
        body,
      });

      const recent = await repository.find({
        kind: "message",
        recipientUserId,
      });
      const now = Date.now();
      const duplicate = recent.find((item) => {
        if (item.fingerprint !== fingerprint) {
          return false;
        }

        const queuedAt = Date.parse(item.queuedAt ?? item.createdAt ?? "");
        if (Number.isNaN(queuedAt)) {
          return false;
        }

        return now - queuedAt <= DEDUPE_WINDOW_MS;
      });

      if (duplicate) {
        return ok(
          {
            skipped: true,
            reason: "duplicate_within_60s",
            duplicateId: duplicate._id,
          },
          202,
        );
      }

      const message = {
        _id: createId("notification"),
        kind: "message",
        recipientUserId,
        templateId,
        variables,
        title,
        body,
        priority,
        priorityWeight: priorityValue(priority),
        status: "queued",
        queuedAt: nowIso(),
        fingerprint,
      };

      const saved = await repository.insertOne(message);
      return ok(saved, 201);
    },

    async listQueue(recipientUserId = null) {
      const filter = recipientUserId
        ? { kind: "message", recipientUserId, status: "queued" }
        : { kind: "message", status: "queued" };

      const items = await repository.find(filter);
      const sorted = [...items].sort((a, b) => {
        const byPriority =
          Number(b.priorityWeight ?? 0) - Number(a.priorityWeight ?? 0);
        if (byPriority !== 0) {
          return byPriority;
        }

        return Date.parse(a.queuedAt ?? "") - Date.parse(b.queuedAt ?? "");
      });

      return ok(sorted);
    },

    async deliverNext(recipientUserId) {
      const queueResult = await this.listQueue(recipientUserId);
      const next = queueResult.data[0];

      if (!next) {
        return ok(null);
      }

      const deliveredAt = nowIso();
      const updated = await repository.updateOne(
        { _id: next._id },
        {
          ...next,
          status: "delivered",
          deliveredAt,
        },
      );

      await repository.insertOne({
        _id: createId("receipt"),
        kind: "delivery_receipt",
        notificationId: next._id,
        recipientUserId: next.recipientUserId,
        deliveredAt,
        status: "delivered",
      });

      return ok(updated);
    },

    async listReceipts(recipientUserId = null) {
      const filter = recipientUserId
        ? { kind: "delivery_receipt", recipientUserId }
        : { kind: "delivery_receipt" };
      const items = await repository.find(filter, {
        sort: { deliveredAt: -1 },
      });
      return ok(items);
    },
  };
}
