import { fail, ok } from "./response";
import { ROLES } from "../auth/roles";
import { REQUEST_STATUS } from "./requestLifecycleService";

function now() {
  return new Date().toISOString();
}

function canReview(role) {
  return role === ROLES.REVIEWER || role === ROLES.ADMIN;
}

function createReviewEntry(actor, request, action, details = {}) {
  return {
    requestId: request._id,
    cycle: request.reviewCycle ?? 0,
    action,
    at: now(),
    byUserId: actor.userId,
    byRole: actor.role,
    ...details,
  };
}

function pushStatus(request, actor, to, action, comment = null) {
  return {
    ...request,
    status: to,
    statusHistory: [
      ...(request.statusHistory ?? []),
      {
        from: request.status,
        to,
        at: now(),
        byUserId: actor.userId,
        byRole: actor.role,
        action,
        comment,
      },
    ],
  };
}

export function createReviewerToolsService({ requests, reviews, auditTrail }) {
  async function persistReviewAction(actor, request, action, details = {}) {
    const reviewEntry = createReviewEntry(actor, request, action, details);

    await reviews.insertOne(reviewEntry);
    if (auditTrail) {
      await auditTrail.append({
        resourceType: "request",
        resourceId: request._id,
        action: action === "review_approve" ? "approve" : action,
        actorUserId: actor.userId,
        actorRole: actor.role,
        metadata: details,
      });
    }

    return reviewEntry;
  }

  return {
    async addComment(actor, requestId, comment) {
      if (!actor?.userId || !canReview(actor.role)) {
        return fail("Only Reviewer or Admin can comment", 403);
      }

      if (!comment || !String(comment).trim()) {
        return fail("Comment is required", 400);
      }

      const request = await requests.findOne({ _id: requestId });
      if (!request) {
        return fail("Request not found", 404);
      }

      const reviewEntry = await persistReviewAction(
        actor,
        request,
        "review_comment",
        {
          comment: String(comment).trim(),
        },
      );

      const next = {
        ...request,
        reviewHistory: [...(request.reviewHistory ?? []), reviewEntry],
        actionLog: [
          ...(request.actionLog ?? []),
          {
            at: reviewEntry.at,
            byUserId: actor.userId,
            byRole: actor.role,
            action: "review_comment",
            comment: reviewEntry.comment,
          },
        ],
      };

      const updated = await requests.updateOne({ _id: requestId }, next);
      return ok(updated);
    },

    async attachExceptionReason(actor, requestId, reason) {
      if (!actor?.userId || !canReview(actor.role)) {
        return fail("Only Reviewer or Admin can add exception reasons", 403);
      }

      const normalizedReason = String(reason ?? "").trim();
      if (!normalizedReason) {
        return fail("Exception reason is required", 400);
      }

      const request = await requests.findOne({ _id: requestId });
      if (!request) {
        return fail("Request not found", 404);
      }

      const reviewEntry = await persistReviewAction(
        actor,
        request,
        "review_exception",
        {
          exceptionReason: normalizedReason,
        },
      );

      const next = {
        ...request,
        exceptionReasons: [
          ...(request.exceptionReasons ?? []),
          normalizedReason,
        ],
        reviewHistory: [...(request.reviewHistory ?? []), reviewEntry],
        actionLog: [
          ...(request.actionLog ?? []),
          {
            at: reviewEntry.at,
            byUserId: actor.userId,
            byRole: actor.role,
            action: "review_exception",
            exceptionReason: normalizedReason,
          },
        ],
      };

      const updated = await requests.updateOne({ _id: requestId }, next);
      return ok(updated);
    },

    async approve(actor, requestId, comment = null) {
      if (!actor?.userId || !canReview(actor.role)) {
        return fail("Only Reviewer or Admin can approve", 403);
      }

      const request = await requests.findOne({ _id: requestId });
      if (!request) {
        return fail("Request not found", 404);
      }

      const allowed = [
        REQUEST_STATUS.REVIEW,
        REQUEST_STATUS.REQUIRES_SECONDARY_REVIEW,
      ];
      if (!allowed.includes(request.status)) {
        return fail(
          `Request cannot be approved in status '${request.status}'`,
          409,
        );
      }

      const reviewEntry = await persistReviewAction(
        actor,
        request,
        "review_approve",
        {
          comment,
          secondaryReview:
            request.status === REQUEST_STATUS.REQUIRES_SECONDARY_REVIEW,
        },
      );

      const next = pushStatus(
        {
          ...request,
          requiresSecondaryReview: false,
          fulfillmentBlocked: false,
          reviewedByUserId: actor.userId,
          reviewComment: comment,
          reviewHistory: [...(request.reviewHistory ?? []), reviewEntry],
          actionLog: [
            ...(request.actionLog ?? []),
            {
              at: reviewEntry.at,
              byUserId: actor.userId,
              byRole: actor.role,
              action: "review_approve",
              comment,
            },
          ],
          timestamps: {
            ...request.timestamps,
            reviewedAt: now(),
            approvedAt: now(),
          },
        },
        actor,
        REQUEST_STATUS.APPROVED,
        "review_approve",
        comment,
      );

      const updated = await requests.updateOne({ _id: requestId }, next);
      return ok(updated);
    },

    async returnWithComments(actor, requestId, comment) {
      if (!actor?.userId || !canReview(actor.role)) {
        return fail("Only Reviewer or Admin can return", 403);
      }

      if (!comment || !String(comment).trim()) {
        return fail("Return comment is required", 400);
      }

      const request = await requests.findOne({ _id: requestId });
      if (!request) {
        return fail("Request not found", 404);
      }

      if (request.status !== REQUEST_STATUS.REVIEW) {
        return fail(
          `Request cannot be returned in status '${request.status}'`,
          409,
        );
      }

      const reviewEntry = await persistReviewAction(
        actor,
        request,
        "review_return",
        {
          comment: String(comment).trim(),
        },
      );

      const next = pushStatus(
        {
          ...request,
          requiresSecondaryReview: false,
          fulfillmentBlocked: true,
          reviewedByUserId: actor.userId,
          reviewComment: comment,
          reviewHistory: [...(request.reviewHistory ?? []), reviewEntry],
          actionLog: [
            ...(request.actionLog ?? []),
            {
              at: reviewEntry.at,
              byUserId: actor.userId,
              byRole: actor.role,
              action: "review_return",
              comment,
            },
          ],
          timestamps: {
            ...request.timestamps,
            reviewedAt: now(),
            returnedAt: now(),
          },
        },
        actor,
        REQUEST_STATUS.RETURNED,
        "review_return",
        comment,
      );

      const updated = await requests.updateOne({ _id: requestId }, next);
      return ok(updated);
    },
  };
}
