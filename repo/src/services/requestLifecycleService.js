import { ok, fail } from "./response";
import { ROLES } from "../auth/roles";

export const REQUEST_STATUS = {
  DRAFT: "draft",
  REVIEW: "review",
  APPROVED: "approved",
  RETURNED: "return",
  ARCHIVED: "archive",
  REQUIRES_SECONDARY_REVIEW: "requires secondary review",
};

const EDITABLE_AFTER_APPROVAL_FIELDS = [
  "requestingOrgId",
  "requestingClassId",
  "itemSku",
  "quantity",
  "deliveryWindow",
];

function now() {
  return new Date().toISOString();
}

function isStudentOrTeacher(role) {
  return role === ROLES.STUDENT || role === ROLES.TEACHER;
}

function hasMonitoredChanges(beforeDoc, patch) {
  return EDITABLE_AFTER_APPROVAL_FIELDS.some((field) => {
    if (!Object.prototype.hasOwnProperty.call(patch, field)) {
      return false;
    }

    return patch[field] !== beforeDoc[field];
  });
}

function appendAction(doc, actor, action, details = {}) {
  return {
    ...doc,
    actionLog: [
      ...(doc.actionLog ?? []),
      {
        at: now(),
        byUserId: actor.userId,
        byRole: actor.role,
        action,
        ...details,
      },
    ],
  };
}

function transitionStatus(doc, actor, to, action, details = {}) {
  const timestamp = now();

  return appendAction(
    {
      ...doc,
      status: to,
      statusHistory: [
        ...(doc.statusHistory ?? []),
        {
          from: doc.status,
          to,
          at: timestamp,
          byUserId: actor.userId,
          byRole: actor.role,
          action,
          comment: details.comment ?? null,
        },
      ],
    },
    actor,
    action,
    details,
  );
}

export function createRequestLifecycleService(repository, options = {}) {
  const { auditTrail } = options;

  return {
    async createDraft(actor, payload) {
      if (!actor?.userId || !isStudentOrTeacher(actor.role)) {
        return fail("Only Students and Teachers can create drafts", 403);
      }

      const request = {
        ...payload,
        status: REQUEST_STATUS.DRAFT,
        ownerUserId: actor.userId,
        requesterUserId: actor.userId,
        reviewCycle: 0,
        requiresSecondaryReview: false,
        fulfillmentBlocked: false,
        timestamps: {
          draftedAt: now(),
          submittedAt: null,
          reviewedAt: null,
          returnedAt: null,
          approvedAt: null,
          archivedAt: null,
        },
        statusHistory: [
          {
            from: null,
            to: REQUEST_STATUS.DRAFT,
            at: now(),
            byUserId: actor.userId,
            byRole: actor.role,
            action: "draft_create",
            comment: null,
          },
        ],
        actionLog: [
          {
            at: now(),
            byUserId: actor.userId,
            byRole: actor.role,
            action: "draft_create",
          },
        ],
        reviewHistory: [],
      };

      const created = await repository.insertOne(request);

      if (auditTrail) {
        await auditTrail.append({
          action: "create",
          resourceType: "request",
          resourceId: created._id,
          actorUserId: actor.userId,
          actorRole: actor.role,
        });
      }

      return ok(created, 201);
    },

    async editDraft(actor, requestId, patch) {
      if (!actor?.userId || !isStudentOrTeacher(actor.role)) {
        return fail("Only Students and Teachers can edit requests", 403);
      }

      const existing = await repository.findOne({ _id: requestId });
      if (!existing) {
        return fail("Request not found", 404);
      }

      if (existing.ownerUserId !== actor.userId && actor.role !== ROLES.ADMIN) {
        return fail("You can edit only your own requests", 403);
      }

      const allowedStatuses = [
        REQUEST_STATUS.DRAFT,
        REQUEST_STATUS.RETURNED,
        REQUEST_STATUS.APPROVED,
        REQUEST_STATUS.REQUIRES_SECONDARY_REVIEW,
      ];

      if (!allowedStatuses.includes(existing.status)) {
        return fail(
          `Request cannot be edited in status '${existing.status}'`,
          409,
        );
      }

      let next = {
        ...existing,
        ...patch,
      };

      if (
        existing.status === REQUEST_STATUS.APPROVED &&
        hasMonitoredChanges(existing, patch)
      ) {
        next = transitionStatus(
          {
            ...next,
            requiresSecondaryReview: true,
            fulfillmentBlocked: true,
            timestamps: {
              ...existing.timestamps,
              reviewedAt: now(),
            },
          },
          actor,
          REQUEST_STATUS.REQUIRES_SECONDARY_REVIEW,
          "secondary_review_required",
        );
      } else {
        next = appendAction(next, actor, "request_edit");
      }

      const updated = await repository.updateOne({ _id: requestId }, next);

      if (auditTrail) {
        await auditTrail.append({
          action: "update",
          resourceType: "request",
          resourceId: requestId,
          actorUserId: actor.userId,
          actorRole: actor.role,
          metadata: { patchKeys: Object.keys(patch ?? {}) },
        });
      }

      return ok(updated);
    },

    async submitForReview(actor, requestId) {
      if (!actor?.userId || !isStudentOrTeacher(actor.role)) {
        return fail("Only Students and Teachers can submit requests", 403);
      }

      const existing = await repository.findOne({ _id: requestId });
      if (!existing) {
        return fail("Request not found", 404);
      }

      if (existing.ownerUserId !== actor.userId && actor.role !== ROLES.ADMIN) {
        return fail("You can submit only your own requests", 403);
      }

      const canSubmitStatuses = [
        REQUEST_STATUS.DRAFT,
        REQUEST_STATUS.RETURNED,
        REQUEST_STATUS.REQUIRES_SECONDARY_REVIEW,
      ];
      if (!canSubmitStatuses.includes(existing.status)) {
        return fail(
          `Request cannot be submitted in status '${existing.status}'`,
          409,
        );
      }

      const next = transitionStatus(
        {
          ...existing,
          reviewCycle: (existing.reviewCycle ?? 0) + 1,
          requiresSecondaryReview: false,
          fulfillmentBlocked: true,
          timestamps: {
            ...existing.timestamps,
            submittedAt: now(),
          },
        },
        actor,
        REQUEST_STATUS.REVIEW,
        "submit_for_review",
      );

      const updated = await repository.updateOne({ _id: requestId }, next);
      return ok(updated);
    },

    async archive(actor, requestId) {
      if (!actor?.userId) {
        return fail("Actor is required", 400);
      }

      const existing = await repository.findOne({ _id: requestId });
      if (!existing) {
        return fail("Request not found", 404);
      }

      const canArchive =
        actor.role === ROLES.ADMIN ||
        (isStudentOrTeacher(actor.role) &&
          existing.ownerUserId === actor.userId);

      if (!canArchive) {
        return fail("Not allowed to archive this request", 403);
      }

      if (
        existing.status !== REQUEST_STATUS.APPROVED &&
        existing.status !== REQUEST_STATUS.RETURNED
      ) {
        return fail(
          `Request cannot be archived in status '${existing.status}'`,
          409,
        );
      }

      const next = transitionStatus(
        {
          ...existing,
          fulfillmentBlocked: true,
          timestamps: {
            ...existing.timestamps,
            archivedAt: now(),
          },
        },
        actor,
        REQUEST_STATUS.ARCHIVED,
        "archive_request",
      );

      const updated = await repository.updateOne({ _id: requestId }, next);
      return ok(updated);
    },
  };
}
